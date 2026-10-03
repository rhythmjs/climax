import type { Middleware } from "@rhythmjs/rhythm/types";
import type { RhythmCliContext } from "@rhythmjs/cli/context";
import { docOnly, type CommandFields } from "../metadata/metadata";

export type CommandHelpOptions = CommandFields;

export function commandHelp(options: CommandHelpOptions): Middleware<RhythmCliContext> {
  return docOnly({ command: options });
}
