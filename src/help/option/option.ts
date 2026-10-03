import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmCliContext } from "@rhythmjs/cli/context";
import { docOnly, type OptionSpec } from "../metadata/metadata";

export type OptionHelpOptions = OptionSpec;

export function optionHelp(options: OptionHelpOptions): Middleware<RhythmCliContext> {
  return docOnly({ options: [options] });
}
