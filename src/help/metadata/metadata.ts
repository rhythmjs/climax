import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmCliContext } from "@rhythmjs/cli/context";

export const HELP_METADATA: symbol = Symbol.for("rhythmjs.climax.help");

export interface CommandFields {
  summary?: string;
  description?: string;
  examples?: readonly string[];
  deprecated?: boolean | string;
  hidden?: boolean;
}

export interface OptionSpec {
  name: string;
  alias?: string;
  description?: string;
  type?: string;
  required?: boolean;
  default?: unknown;
}

export interface HelpFragment {
  command?: CommandFields;
  options?: readonly OptionSpec[];
}

export function withFragment<TFn>(fn: TFn, fragment: HelpFragment): TFn {
  Object.defineProperty(fn, HELP_METADATA, { value: fragment });
  return fn;
}

export function fragmentOf(fn: unknown): HelpFragment | undefined {
  if (typeof fn !== "function") return undefined;
  return (fn as unknown as Record<symbol, unknown>)[HELP_METADATA] as HelpFragment | undefined;
}

export function docOnly(fragment: HelpFragment): Middleware<RhythmCliContext> {
  return withFragment(async (_ctx, next) => {
    await next();
  }, fragment);
}
