import { sourceOf } from "@rhythmjs/rhythm/source";
import { fragmentOf, type CommandFields, type OptionSpec } from "../metadata/metadata";

export interface CliSource {
  readonly entries: ReadonlyArray<
    | { readonly kind: "middleware"; readonly fn: unknown }
    | { readonly kind: "command"; readonly segments: readonly string[]; readonly handlers: readonly unknown[] }
  >;
}

export interface CommandDoc extends CommandFields {
  segments: readonly string[];
  usage: string;
  options: readonly OptionSpec[];
}

export interface GenerateOptions {
  includeUndocumented?: boolean;
  includeHidden?: boolean;
}

export function isCliSource(value: unknown): value is CliSource {
  return typeof value === "object" && value !== null && Array.isArray((value as { entries?: unknown }).entries);
}

export function usageOf(segments: readonly string[]): string {
  return segments
    .map((segment) => {
      if (segment === "**") return "[args...]";
      if (!segment.startsWith(":")) return segment;
      return segment.endsWith("?") ? `[${segment.slice(1, -1)}]` : `<${segment.slice(1)}>`;
    })
    .join(" ");
}

function walk(
  cli: CliSource,
  inherited: readonly OptionSpec[],
  options: GenerateOptions,
  out: CommandDoc[],
  seen: Set<object>,
): void {
  if (seen.has(cli)) return;
  seen.add(cli);

  const scoped: OptionSpec[] = [...inherited];
  for (const entry of cli.entries) {
    if (entry.kind === "middleware") {
      const child = sourceOf(entry.fn);
      if (isCliSource(child)) {
        walk(child, scoped, options, out, seen);
        continue;
      }
      const fragment = fragmentOf(entry.fn);
      if (fragment?.options) scoped.push(...fragment.options);
      continue;
    }

    const fragments = entry.handlers.map(fragmentOf).filter((fragment) => !!fragment);
    const command: CommandFields = Object.assign({}, ...fragments.map((fragment) => fragment.command));
    if (!fragments.length && !(options.includeUndocumented ?? true)) continue;
    if (command.hidden && !(options.includeHidden ?? false)) continue;

    out.push({
      ...command,
      segments: [...entry.segments],
      usage: usageOf(entry.segments),
      options: [...scoped, ...fragments.flatMap((fragment) => fragment.options ?? [])],
    });
  }
}

export function generate(clis: CliSource | readonly CliSource[], options: GenerateOptions = {}): CommandDoc[] {
  const out: CommandDoc[] = [];
  const seen = new Set<object>();
  for (const cli of Array.isArray(clis) ? (clis as readonly CliSource[]) : [clis as CliSource]) {
    walk(cli, [], options, out, seen);
  }
  return out;
}
