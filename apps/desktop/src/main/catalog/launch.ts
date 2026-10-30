import {
  commandLine,
  inputValue,
  type CatalogEntry,
  type CatalogInput,
  type CatalogRunner,
  type RegistryArgument,
  type RegistryEntry,
  type RegistryEnvVar,
  type RegistryInput,
  type RegistryPackage,
  type RegistryServer
} from "@openmcp/contracts";

export type Values = Record<string, string>;
export type BuiltLaunch = { command: CatalogRunner; args: string[]; env: Values; secrets: Values };
export type Plan = { runner: CatalogRunner; inputs: CatalogInput[]; build: (values: Values) => BuiltLaunch };

type Piece<T> = { inputs: CatalogInput[]; render: (values: Values) => T };
type EnvValue = { name: string; value: string; secret: boolean };
type Variables = Record<string, RegistryInput> | null | undefined;

const runners: Partial<Record<string, CatalogRunner>> = { npm: "npx", pypi: "uvx", oci: "docker" };
const heads: Record<CatalogRunner, string[]> = { npx: ["-y"], uvx: [], docker: ["run", "-i", "--rm"] };
const dockerEnv = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;

const isSecret = (source: RegistryInput & { variables?: Variables }) =>
  !!source.isSecret || Object.values(source.variables ?? {}).some((variable) => !!variable.isSecret);

const https = (url: string | undefined) => (url?.startsWith("https://") ? url : null);

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

// ponytail: isRepeated arguments take one value; add an "add another" control if the 49 servers using it matter.
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

function envVar(env: RegistryEnvVar): Piece<EnvValue | null> {
  const id = `env:${env.name}`;
  const secret = isSecret(env);
  const set = (value: string | null) => (value ? { name: env.name, value, secret } : null);

  if (env.value !== undefined) {
    const value = template(id, env.value, env.variables, secret);
    return { inputs: value.inputs, render: (values) => set(value.render(values)) };
  }

  const input = { ...field(id, env.name, env), secret };
  return { inputs: [input], render: (values) => set(inputValue(input, values) || null) };
}

function forwardedEnv(arg: RegistryArgument): RegistryEnvVar | null {
  if (arg.name !== "-e" && arg.name !== "--env") return null;

  const match = dockerEnv.exec(arg.value ?? "");
  return match ? { ...arg, name: match[1], value: match[2] } : null;
}

function target(pkg: RegistryPackage, runner: CatalogRunner) {
  if (runner === "npx") return `${pkg.identifier}@${pkg.version}`;
  if (runner === "uvx") return `${pkg.identifier}==${pkg.version}`;

  const tagged = /[:@][^/]*$/.test(pkg.identifier);
  return tagged || !pkg.version ? pkg.identifier : `${pkg.identifier}:${pkg.version}`;
}

export function planFor(pkg: RegistryPackage): Plan | null {
  const runner = runners[pkg.registryType];
  if (!runner || pkg.transport.type !== "stdio" || (runner !== "docker" && !pkg.version)) return null;

  const runtimeArgs = pkg.runtimeArguments ?? [];
  const env = (pkg.environmentVariables ?? []).map(envVar);
  const runtime: Piece<string[]>[] = [];
  const trailing: Piece<string[]>[] = [];

  for (const [index, arg] of [...runtimeArgs, ...(pkg.packageArguments ?? [])].entries()) {
    const forwarded = runner === "docker" && index < runtimeArgs.length ? forwardedEnv(arg) : null;

    if (forwarded) env.push(envVar(forwarded));
    else if (isSecret(arg)) return null;
    else (index < runtimeArgs.length ? runtime : trailing).push(argument(arg, `arg:${index}`));
  }

  return {
    runner,
    inputs: [...env, ...runtime, ...trailing].flatMap((piece) => piece.inputs),
    build: (values) => {
      const set = env.map((piece) => piece.render(values)).filter((value) => value !== null);
      const pick = (secret: boolean) =>
        Object.fromEntries(set.filter((value) => value.secret === secret).map(({ name, value }) => [name, value]));

      return {
        command: runner,
        args: [
          ...heads[runner],
          ...runtime.flatMap((piece) => piece.render(values)),
          ...(runner === "docker" ? set.flatMap(({ name }) => ["-e", name]) : []),
          target(pkg, runner),
          ...trailing.flatMap((piece) => piece.render(values))
        ],
        env: pick(false),
        secrets: pick(true)
      };
    }
  };
}

export function choosePlan(server: RegistryServer): Plan | null {
  for (const pkg of server.packages ?? []) {
    const plan = planFor(pkg);
    if (plan) return plan;
  }

  return null;
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

export function toCatalogEntry({ server, _meta }: RegistryEntry): CatalogEntry | null {
  const plan = choosePlan(server);
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
    command: commandLine(plan.build(previewValues(plan.inputs)))
  };
}
