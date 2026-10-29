import type { Tool } from "@openmcp/contracts";

export type Field = { name: string; type: string; required: boolean; description?: string };

type Schema = Record<string, unknown>;

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
      description: typeof property.description === "string" ? property.description : undefined
    };
  });
}

function typeName(schema: Schema): string {
  if (typeof schema.type === "string") {
    return schema.type === "array" && isSchema(schema.items) ? `${typeName(schema.items)}[]` : schema.type;
  }

  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (Array.isArray(schema.anyOf)) return schema.anyOf.filter(isSchema).map(typeName).join(" | ");

  return "any";
}
