import type { RhythmCli } from "@rhythmjs/cli";
import type { CliSource } from "../generate/generate";

type Entry = CliSource["entries"][number];

/**
 * A `RhythmCli` does not expose its commands, so help cannot read them back. `documented(cli)` records every
 * `cmd()` and `use()` call, in order, and exposes them as `entries`: the shape `generate()` and the help module
 * discover through the host app's `sources`. Mounted children must be documented too to be walked.
 */
export function documented<C extends RhythmCli<any, any>>(cli: C): C & CliSource {
  const entries: Entry[] = [];
  const target = cli as unknown as Record<"cmd" | "use", (...args: unknown[]) => unknown>;
  const { cmd, use } = target;

  target.cmd = function (this: unknown, command: unknown, ...handlers: unknown[]) {
    const segments = String(command).trim().split(/\s+/).filter(Boolean);
    entries.push({ kind: "command", segments, handlers });
    return cmd.call(this, command, ...handlers);
  };
  target.use = function (this: unknown, middleware: unknown) {
    entries.push({ kind: "middleware", fn: middleware });
    return use.call(this, middleware);
  };

  Object.defineProperty(cli, "entries", { value: entries });
  return cli as C & CliSource;
}
