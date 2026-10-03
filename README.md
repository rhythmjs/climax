# @rhythmjs/climax

General-purpose building blocks for [Rhythm](https://github.com/rhythmjs/rhythm) CLIs, one feature per subpath. Today that is **help** (`@rhythmjs/climax/help/*`): commands are documented by small single-purpose
middlewares (`commandHelp`, `optionHelp`); a generator walks the registered `RhythmCli`s; a module answers `--help`, `-h`
and `help [command]`. Like `@rhythmjs/openapi`, the module is never handed the cli: it discovers it through the host
app's `sources`. Each piece has its own subpath; there is no root barrel export.

## Install

```sh
bun add @rhythmjs/climax @rhythmjs/cli @rhythmjs/rhythm
```

## Quick start

```ts
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmCli } from "@rhythmjs/cli";
import { toCliHandler } from "@rhythmjs/cli/run";
import type { RhythmCliContext } from "@rhythmjs/cli/context";
import { commandHelp } from "@rhythmjs/climax/help/command";
import { optionHelp } from "@rhythmjs/climax/help/option";
import { helpModule } from "@rhythmjs/climax/help/module";

const cli = new RhythmCli().command(
  "deploy :environment",
  commandHelp({ summary: "Deploy the app", examples: ["app deploy prod"] }),
  optionHelp({ name: "force", alias: "f", description: "Skip checks" }),
  (ctx) => ctx.response.print(`deploying to ${ctx.args.environment}`),
);

const app = new Rhythm<RhythmCliContext>()
  .register(helpModule.forRoot({ name: "app", description: "My app" }))
  .use(cli.middleware());

process.exitCode = await toCliHandler(app)(process.argv.slice(2));
```

```
$ app --help
$ app help deploy
$ app deploy prod -h
```

Register the module **before** the cli: registration order is execution order, and help answers (without calling
`next()`) before any command runs.

## Behavior

- **Discovery**: the module documents the app it is `register()`ed in (`module.parent.sources`); mounted clis
  (`.use(child.middleware())`) are walked recursively. Unregistered use throws a clear error.
- **Topics**: `help` / `--help` prints the command index; a full command prints usage, summary, description, options and
  examples; a prefix (`app user --help`) lists that group's subcommands; an unknown topic prints the index and exits 1.
- **Options inherit by order**: `optionHelp` used via `.use()` applies to the commands registered after it (and to mounted
  clis), never to earlier ones or the parent. Used as a command handler it applies to that command only.
- `commandHelp`: `summary`, `description`, `examples`, `deprecated` (`true` or a message), `hidden`.
- `optionHelp`: `name`, `alias`, `description`, `type` (value placeholder), `required`, `default`.
- `helpModule.forRoot(options)`: `name` (program name in usage), `description`, `command` (`"help"` by default, `false`
  to keep only the flags), `includeUndocumented` (default `true`), `includeHidden` (default `false`).
- The module exposes `ctx.helpService` with `commands()` (structured `CommandDoc[]`, for custom renderers) and `render(topic)`.
- Flags are matched on raw argv, before `--`. Values of other flags (`--env prod`) count as topic tokens, so put
  `--help` before them or use `app help <command>` when a flag value could be mistaken for a command word.
