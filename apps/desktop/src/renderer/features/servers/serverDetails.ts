import type { Tool } from "@openmcp/contracts";

type Choice = string | number | boolean;

export type Field = {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  input: "text" | "number" | "integer" | "boolean" | "enum" | "json";
  choices?: Choice[];
};

type Schema = Record<string, unknown>;

const INPUTS = new Map<unknown, Field["input"]>([
  ["string", "text"],
  ["number", "number"],
  ["integer", "integer"],
  ["boolean", "boolean"]
]);

const isChoice = (value: unknown): value is Choice => ["string", "number", "boolean"].includes(typeof value);

const UNITS = [
  ["d", 86_400],
  ["h", 3_600],
  ["m", 60],
  ["s", 1]
] as const;

const clock = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

const isSchema = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const formatTime = (date: Date) => clock.format(date);

export function formatUptime(ms: number) {
  let seconds = Math.max(0, Math.floor(ms / 1000));
  const parts: string[] = [];

  for (const [unit, size] of UNITS) {
    const count = Math.floor(seconds / size);
    seconds %= size;
    if (count > 0 || parts.length > 0 || unit === "s") parts.push(`${count}${unit}`);
  }

  return parts.slice(0, 2).join(" ");
}

export function toolParameters({ properties = {}, required = [] }: Tool["inputSchema"]): Field[] {
  return Object.entries(properties).map(([name, schema]) => {
    const property = isSchema(schema) ? schema : {};

    return {
      name,
      type: typeName(property),
      required: required.includes(name),
      description: typeof property.description === "string" ? property.description : undefined,
      ...formInput(property)
    };
  });
}

// A nullable property, like `type: ["string", "null"]`, gets the input for its other type.
function formInput(schema: Schema): Pick<Field, "input" | "choices"> {
  if (Array.isArray(schema.enum)) {
    return schema.enum.every(isChoice) ? { input: "enum", choices: schema.enum } : { input: "json" };
  }

  if (Array.isArray(schema.anyOf)) {
    const variants = schema.anyOf.filter((variant) => !isSchema(variant) || variant.type !== "null");
    return variants.length === 1 && isSchema(variants[0]) ? formInput(variants[0]) : { input: "json" };
  }

  const types = (Array.isArray(schema.type) ? schema.type : [schema.type]).filter((type) => type !== "null");
  return { input: (types.length === 1 && INPUTS.get(types[0])) || "json" };
}

export function toolArguments(fields: Field[], values: Record<string, string>) {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.name] ?? "";

    if (value.trim() === "") {
      // A switch nobody touched still reads as off.
      if (field.input === "boolean" && field.required) args[field.name] = false;
      else if (field.required) errors[field.name] = "Enter a value.";
      continue;
    }

    const parsed = parseValue(field, value);
    if ("error" in parsed) errors[field.name] = parsed.error;
    else args[field.name] = parsed.value;
  }

  return { arguments: args, errors };
}

function parseValue(field: Field, value: string): { value: unknown } | { error: string } {
  if (field.input === "text") return { value };
  if (field.input === "boolean") return { value: value === "true" };
  if (field.input === "enum") return { value: field.choices?.find((choice) => String(choice) === value) };
  if (field.input === "json") {
    const parsed = parseJson(value);
    return parsed === undefined ? { error: "Enter valid JSON." } : { value: parsed };
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return { error: "Enter a number." };
  if (field.input === "integer" && !Number.isInteger(number)) return { error: "Enter a whole number." };
  return { value: number };
}

export const formValues = (fields: Field[], args: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(
    fields.map(({ name, input }) => {
      const value = args[name];
      if (value === undefined) return [name, ""];
      return [name, input === "json" ? JSON.stringify(value, null, 2) : String(value)];
    })
  );

export function parseArguments(text: string) {
  const value = parseJson(text);
  return isSchema(value) ? value : null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function typeName(schema: Schema): string {
  if (typeof schema.type === "string") {
    return schema.type === "array" && isSchema(schema.items) ? `${typeName(schema.items)}[]` : schema.type;
  }

  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (Array.isArray(schema.anyOf)) return schema.anyOf.filter(isSchema).map(typeName).join(" | ");

  return "any";
}
