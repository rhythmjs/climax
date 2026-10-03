import type { CommandDoc } from "../generate/generate";
import type { OptionSpec } from "../metadata/metadata";

export interface RenderOptions {
  name?: string;
  description?: string;
}

export type Resolved =
  | { kind: "index" }
  | { kind: "command"; doc: CommandDoc }
  | { kind: "group"; docs: readonly CommandDoc[] }
  | { kind: "none" };

const isParam = (segment: string) => segment.startsWith(":");
const isOptional = (segment: string) => isParam(segment) && segment.endsWith("?");

function fits(segments: readonly string[], tokens: readonly string[]): boolean {
  const catchAll = segments.at(-1) === "**";
  const fixed = catchAll ? segments.slice(0, -1) : segments;
  const required = fixed.filter((segment) => !isOptional(segment)).length;
  if (tokens.length < required || (!catchAll && tokens.length > fixed.length)) return false;
  return fixed.every((segment, i) => tokens[i] === undefined || isParam(segment) || segment === tokens[i]);
}

function literalsOf(segments: readonly string[]): readonly string[] {
  const end = segments.findIndex((segment) => isParam(segment) || segment === "**");
  return end === -1 ? segments : segments.slice(0, end);
}

function named(segments: readonly string[], tokens: readonly string[]): boolean {
  const literals = literalsOf(segments);
  return literals.length === tokens.length && literals.every((literal, i) => literal === tokens[i]);
}

function startsWith(segments: readonly string[], tokens: readonly string[]): boolean {
  return segments.length > tokens.length && tokens.every((token, i) => isParam(segments[i]!) || segments[i] === token);
}

export function resolve(docs: readonly CommandDoc[], topic: readonly string[]): Resolved {
  if (!topic.length) return { kind: "index" };
  const exact = docs.find((doc) => fits(doc.segments, topic)) ?? docs.find((doc) => named(doc.segments, topic));
  if (exact) return { kind: "command", doc: exact };
  const group = docs.filter((doc) => startsWith(doc.segments, topic));
  return group.length ? { kind: "group", docs: group } : { kind: "none" };
}

function table(rows: readonly (readonly [string, string])[]): string[] {
  const width = Math.max(0, ...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => (right ? `  ${left.padEnd(width)}  ${right}` : `  ${left}`));
}

function summaryOf(doc: CommandDoc): string {
  const base = doc.summary ?? "";
  if (!doc.deprecated) return base;
  const note = typeof doc.deprecated === "string" ? `deprecated: ${doc.deprecated}` : "deprecated";
  return base ? `${base} (${note})` : `(${note})`;
}

function optionRow(option: OptionSpec): [string, string] {
  const flags = option.alias ? `-${option.alias}, --${option.name}` : `    --${option.name}`;
  const left = option.type ? `${flags} <${option.type}>` : flags;
  const notes = [
    option.required ? "required" : undefined,
    option.default !== undefined ? `default: ${JSON.stringify(option.default)}` : undefined,
  ].filter(Boolean);
  const right = [option.description, notes.length ? `(${notes.join(", ")})` : undefined].filter(Boolean).join(" ");
  return [left, right];
}

function commandList(docs: readonly CommandDoc[]): string[] {
  return table(docs.map((doc) => [doc.usage, summaryOf(doc)] as const));
}

export function renderIndex(docs: readonly CommandDoc[], options: RenderOptions = {}): string[] {
  const name = options.name ?? "";
  const prefix = name ? `${name} ` : "";
  const lines: string[] = [];
  if (options.description) lines.push(options.description, "");
  lines.push(`Usage: ${prefix}<command> [options]`, "", "Commands:", ...commandList(docs));
  lines.push("", `Run \`${prefix}help <command>\` for details on a command.`);
  return lines;
}

export function renderGroup(
  docs: readonly CommandDoc[],
  topic: readonly string[],
  options: RenderOptions = {},
): string[] {
  const prefix = options.name ? `${options.name} ` : "";
  return [`Usage: ${prefix}${topic.join(" ")} <command> [options]`, "", "Commands:", ...commandList(docs)];
}

export function renderCommand(doc: CommandDoc, options: RenderOptions = {}): string[] {
  const prefix = options.name ? `${options.name} ` : "";
  const lines: string[] = [`Usage: ${prefix}${doc.usage}${doc.options.length ? " [options]" : ""}`];
  if (doc.summary) lines.push("", doc.summary);
  if (doc.deprecated)
    lines.push("", typeof doc.deprecated === "string" ? `Deprecated: ${doc.deprecated}` : "Deprecated.");
  if (doc.description) lines.push("", doc.description);
  if (doc.options.length) lines.push("", "Options:", ...table(doc.options.map(optionRow)));
  if (doc.examples?.length) lines.push("", "Examples:", ...doc.examples.map((example) => `  $ ${example}`));
  return lines;
}

export function render(docs: readonly CommandDoc[], topic: readonly string[], options: RenderOptions = {}): string[] {
  const resolved = resolve(docs, topic);
  switch (resolved.kind) {
    case "index":
      return renderIndex(docs, options);
    case "command":
      return renderCommand(resolved.doc, options);
    case "group":
      return renderGroup(resolved.docs, topic, options);
    case "none":
      return [`Unknown command: ${topic.join(" ")}`, "", ...renderIndex(docs, options)];
  }
}
