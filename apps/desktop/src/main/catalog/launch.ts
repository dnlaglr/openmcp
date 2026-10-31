import {
  inputValue,
  launchLabel,
  type CatalogEntry,
  type CatalogInput,
  type CatalogRunner,
  type LaunchSpec,
  type RegistryArgument,
  type RegistryEntry,
  type RegistryEnvVar,
  type RegistryInput,
  type RegistryPackage,
  type RegistryRemote,
  type RegistryServer
} from "@openmcp/contracts";

import type { HttpLaunch, Launch, StdioLaunch } from "../servers/connection";

export type Values = Record<string, string>;
export type BuiltLaunch<L extends Launch = Launch> = L & { secrets: Values };
export type Plan<L extends Launch = Launch> = {
  runner: CatalogRunner;
  // The pinned package for a package plan, the URL template for a remote one.
  package: string;
  inputs: CatalogInput[];
  build: (values: Values) => BuiltLaunch<L>;
};

type Piece<T> = { inputs: CatalogInput[]; render: (values: Values) => T };
type EnvValue = { name: string; value: string; secret: boolean };
type Variables = Record<string, RegistryInput> | null | undefined;
type PackageRunner = Exclude<CatalogRunner, "remote">;

const runners: Partial<Record<string, PackageRunner>> = { npm: "npx", pypi: "uvx", oci: "docker" };
const heads: Record<PackageRunner, string[]> = { npx: ["-y"], uvx: [], docker: ["run", "-i", "--rm"] };
const dockerEnv = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;

const isSecret = (source: RegistryInput & { variables?: Variables }) =>
  !!source.isSecret || Object.values(source.variables ?? {}).some((variable) => !!variable.isSecret);

const https = (url: string | undefined) => (url?.startsWith("https://") ? url : null);

const valuesOf = (set: EnvValue[], secret: boolean) =>
  Object.fromEntries(set.filter((value) => value.secret === secret).map(({ name, value }) => [name, value]));

function field(id: string, label: string, source: RegistryInput, kind: CatalogInput["kind"] = "text"): CatalogInput {
  return {
    id,
    label,
    kind,
    description: source.description ?? null,
    required: !!source.isRequired,
    secret: !!source.isSecret,
    default: source.default ?? null,
    choices: source.choices?.length ? source.choices : null,
    placeholder: source.placeholder ?? null
  };
}

// Fills {name} placeholders from their own inputs; any empty variable drops the whole value.
function template(id: string, value: string, variables: Variables, secret: boolean): Piece<string | null> {
  const inputs = Object.entries(variables ?? {})
    .filter(([name]) => value.includes(`{${name}}`))
    .map(([name, variable]) => ({ ...field(`${id}:${name}`, name, variable), secret: secret || !!variable.isSecret }));

  return {
    inputs,
    render: (values) => {
      let result = value;
      for (const input of inputs) {
        const filled = inputValue(input, values);
        if (!filled) return null;

        result = result.replaceAll(`{${input.label}}`, () => filled);
      }
      return result;
    }
  };
}

// isRepeated arguments take one value; add an "add another" control if the 49 servers using it matter.
function argument(arg: RegistryArgument, id: string): Piece<string[]> {
  const flag = arg.type === "named" && arg.name ? [arg.name] : [];
  const emit = (value: string | null) => (value ? [...flag, value] : []);

  if (arg.value !== undefined) {
    const value = template(id, arg.value, arg.variables, false);
    return { inputs: value.inputs, render: (values) => emit(value.render(values)) };
  }

  if (flag.length > 0 && arg.format === "boolean") {
    if (arg.isRequired) return { inputs: [], render: () => flag };

    const input = field(id, flag[0], arg, "flag");
    return { inputs: [input], render: (values) => (inputValue(input, values) === "true" ? flag : []) };
  }

  const asksForValue = arg.format || arg.valueHint || arg.default !== undefined || arg.isRequired || arg.description;
  if (flag.length > 0 && !asksForValue) return { inputs: [], render: () => flag };

  const input = field(id, flag[0] ?? arg.valueHint ?? arg.name ?? "Argument", arg);
  return { inputs: [input], render: (values) => emit(inputValue(input, values) || null) };
}

function envVar(env: RegistryEnvVar, prefix = "env"): Piece<EnvValue | null> {
  const id = `${prefix}:${env.name}`;
  const secret = isSecret(env);
  const set = (value: string | null) => (value ? { name: env.name, value, secret } : null);

  if (env.value !== undefined) {
    const value = template(id, env.value, env.variables, secret);
    return { inputs: value.inputs, render: (values) => set(value.render(values)) };
  }

  const input = { ...field(id, env.name, env), secret };
  return { inputs: [input], render: (values) => set(inputValue(input, values) || null) };
}

// Publishers often write "Bearer {token}" without declaring token; it takes the header's own description and flags.
function withImplicitVariables(header: RegistryEnvVar): RegistryEnvVar {
  const used = [...(header.value ?? "").matchAll(/(?<!\$)\{([A-Za-z0-9_.-]+)\}/g)].map(([, name]) => name);
  const missing = used.filter((name) => !header.variables?.[name]);
  if (missing.length === 0) return header;

  const implicit = { description: header.description, isRequired: header.isRequired, isSecret: header.isSecret };
  return {
    ...header,
    variables: { ...header.variables, ...Object.fromEntries(missing.map((name) => [name, implicit])) }
  };
}

function forwardedEnv(arg: RegistryArgument): RegistryEnvVar | null {
  if (arg.name !== "-e" && arg.name !== "--env") return null;

  const match = dockerEnv.exec(arg.value ?? "");
  return match ? { ...arg, name: match[1], value: match[2] } : null;
}

function target(pkg: RegistryPackage, runner: PackageRunner) {
  if (runner === "npx") return `${pkg.identifier}@${pkg.version}`;
  if (runner === "uvx") return `${pkg.identifier}==${pkg.version}`;

  const tagged = /[:@][^/]*$/.test(pkg.identifier);
  return tagged || !pkg.version ? pkg.identifier : `${pkg.identifier}:${pkg.version}`;
}

export function planFor(pkg: RegistryPackage): Plan<StdioLaunch> | null {
  const runner = runners[pkg.registryType];
  if (!runner || pkg.transport.type !== "stdio" || (runner !== "docker" && !pkg.version)) return null;

  const runtimeArgs = pkg.runtimeArguments ?? [];
  const env = (pkg.environmentVariables ?? []).map((variable) => envVar(variable));
  const runtime: Piece<string[]>[] = [];
  const trailing: Piece<string[]>[] = [];

  for (const [index, arg] of [...runtimeArgs, ...(pkg.packageArguments ?? [])].entries()) {
    const forwarded = runner === "docker" && index < runtimeArgs.length ? forwardedEnv(arg) : null;

    if (forwarded) env.push(envVar(forwarded));
    else if (isSecret(arg)) return null;
    else (index < runtimeArgs.length ? runtime : trailing).push(argument(arg, `arg:${index}`));
  }

  const pinned = target(pkg, runner);

  return {
    runner,
    package: pinned,
    inputs: [...env, ...runtime, ...trailing].flatMap((piece) => piece.inputs),
    build: (values) => {
      const set = env.map((piece) => piece.render(values)).filter((value) => value !== null);

      return {
        type: "stdio",
        command: runner,
        args: [
          ...heads[runner],
          ...runtime.flatMap((piece) => piece.render(values)),
          ...(runner === "docker" ? set.flatMap(({ name }) => ["-e", name]) : []),
          pinned,
          ...trailing.flatMap((piece) => piece.render(values))
        ],
        env: valuesOf(set, false),
        secrets: valuesOf(set, true)
      };
    }
  };
}

// A secret in the URL would be stored in plain text, so those remotes are left out like secret arguments are.
export function remotePlan(remote: RegistryRemote): Plan<HttpLaunch> | null {
  const variables = Object.values(remote.variables ?? {});
  if (remote.type !== "streamable-http" || variables.some((variable) => variable.isSecret)) return null;

  const url = template("url", remote.url, remote.variables, false);
  const headers = (remote.headers ?? []).map((header) => envVar(withImplicitVariables(header), "header"));

  return {
    runner: "remote",
    package: remote.url,
    // There's no URL without its variables, so they're required even when the registry says otherwise.
    inputs: [...url.inputs.map((input) => ({ ...input, required: true })), ...headers.flatMap((piece) => piece.inputs)],
    build: (values) => {
      const set = headers.map((piece) => piece.render(values)).filter((value) => value !== null);
      return {
        type: "http",
        url: url.render(values) ?? remote.url,
        headers: valuesOf(set, false),
        secrets: valuesOf(set, true)
      };
    }
  };
}

// Packages come first; `type` keeps an installed server on the kind it was installed as.
export function choosePlan(server: RegistryServer, type?: LaunchSpec["type"]): Plan | null {
  const plans = [
    ...(type === "http" ? [] : (server.packages ?? []).map(planFor)),
    ...(type === "stdio" ? [] : (server.remotes ?? []).map(remotePlan))
  ];
  return plans.find((plan) => plan !== null) ?? null;
}

// Every input filled in, so an added, renamed or moved input changes the built launch.
const filledLaunch = (plan: Plan) =>
  plan.build(
    Object.fromEntries(plan.inputs.map((input) => [input.id, input.kind === "flag" ? "true" : `‹${input.id}›`]))
  );

function settingsOf(plan: Plan) {
  const launch = filledLaunch(plan);
  const inputs = plan.inputs.map((input) => ({ ...input, description: null, placeholder: null }));
  const unpinned =
    launch.type === "stdio" ? { ...launch, args: launch.args.map((arg) => (arg === plan.package ? "" : arg)) } : launch;

  return JSON.stringify({ runner: plan.runner, inputs, launch: unpinned });
}

// Moves a stored launch to another version by swapping only its pinned package, so every value, manual edit and
// secret stays. A remote launch has nothing pinned and stays as it is. Null when the versions differ in anything else
// or the launch no longer pins the old package.
export function swapPackage(launch: LaunchSpec, from: Plan | null, to: Plan): LaunchSpec | null {
  if (!from || settingsOf(from) !== settingsOf(to)) return null;
  if (launch.type === "http") return to.runner === "remote" ? launch : null;
  if (launch.command !== to.runner || launch.args.filter((arg) => arg === from.package).length !== 1) return null;

  return { ...launch, args: launch.args.map((arg) => (arg === from.package ? to.package : arg)) };
}

export function defaultServerName(registryName: string) {
  const [namespace, last = ""] = registryName.split("/");
  const stripped = last.replace(/^mcp-/i, "").replace(/-(mcp-server|mcp|server)$/i, "");
  const base = stripped && stripped.toLowerCase() !== "mcp" ? stripped : (namespace.split(".").at(-1) ?? namespace);

  return base.replace(/[^A-Za-z0-9_-]/g, "-");
}

const previewValues = (inputs: CatalogInput[]): Values =>
  Object.fromEntries(
    inputs.map((input) => [input.id, inputValue(input, {}) || (input.required ? `‹${input.label}›` : "")])
  );

export function toCatalogEntry({ server, _meta }: RegistryEntry, type?: LaunchSpec["type"]): CatalogEntry | null {
  const plan = choosePlan(server, type);
  if (!plan) return null;

  const official = _meta?.["io.modelcontextprotocol.registry/official"];
  return {
    name: server.name,
    title: server.title ?? server.name.split("/").at(-1) ?? server.name,
    description: server.description,
    version: server.version,
    runner: plan.runner,
    repositoryUrl: https(server.repository?.url),
    websiteUrl: https(server.websiteUrl),
    deprecated: official?.status === "deprecated" ? (official.statusMessage ?? "") : null,
    defaultName: defaultServerName(server.name),
    inputs: plan.inputs,
    command: launchLabel(plan.build(previewValues(plan.inputs)))
  };
}
