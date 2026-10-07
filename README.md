# @rhythmjs/climax

General-purpose building blocks for [Rhythm](https://github.com/rhythmjs/rhythm) CLIs, one feature per subpath. Today that is **help** (`@rhythmjs/climax/help/*`): commands are documented by small single-purpose
middlewares (`commandHelp`, `optionHelp`); a generator walks the `documented` `RhythmCli`s; a module answers `--help`, `-h`
and `help [command]`. Like `@rhythmjs/openapi`, the module is never handed the cli: it discovers it through the host
app's `sources`. Each piece has its own subpath; there is no root barrel export.

## Install

```sh
bun add @rhythmjs/climax @rhythmjs/cli @rhythmjs/rhythm
```

## Quick start

```ts
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { RhythmCli } from "@rhythmjs/cli";
import { toCliHandler } from "@rhythmjs/cli/run";
import { commandHelp } from "@rhythmjs/climax/help/command";
import { optionHelp } from "@rhythmjs/climax/help/option";
import { documented } from "@rhythmjs/climax/help/documented";
import { helpModule } from "@rhythmjs/climax/help/module";

const cli = documented(new RhythmCli()).cmd(
  "deploy :environment",
  commandHelp({ summary: "Deploy the app", examples: ["app deploy prod"] }),
  optionHelp({ name: "force", alias: "f", description: "Skip checks" }),
  (ctx) => ctx.log(`deploying to ${ctx.params.environment}`),
);

const app = new Rhythm().use(helpModule.forRoot({ name: "app", description: "My app" })).use(mount(cli));

process.exitCode = await toCliHandler(app)(process.argv.slice(2));
```

```
$ app --help
$ app help deploy
$ app deploy prod -h
```

Use the module **before** mounting the cli: middleware runs in order, and help answers (without calling `next()`)
before any command runs.

A `RhythmCli` does not expose its commands, so wrap it with `documented(cli)`: it records every `cmd()` and `use()` call
(in order) and exposes them as `entries`, which is what help discovers. Wrap mounted child clis as well.

## Behavior

- **Discovery**: the module documents the app it is `use()`d in (its `parent.sources`); `documented` clis mounted into
  it, and clis mounted into those (`.use(mount(child))`), are walked recursively. Using it outside an app throws a clear
  error.
- **Topics**: `help` / `--help` prints the command index; a full command prints usage, summary, description, options and
  examples; a prefix (`app user --help`) lists that group's subcommands; an unknown topic prints the index and exits 1.
- **Options inherit by order**: `optionHelp` used via `.use()` applies to the commands registered after it (and to mounted
  clis), never to earlier ones or the parent. Used as a command handler it applies to that command only.
- `commandHelp`: `summary`, `description`, `examples`, `deprecated` (`true` or a message), `hidden`.
- `optionHelp`: `name`, `alias`, `description`, `type` (value placeholder), `required`, `default`.
- `helpModule.forRoot(options)`: `name` (program name in usage), `description`, `command` (`"help"` by default, `false`
  to keep only the flags), `includeUndocumented` (default `true`), `includeHidden` (default `false`).
- The module exposes `helpModule.forRoot(...).helpService` with `commands()` (structured `CommandDoc[]`, for custom renderers) and `render(topic)`.
- Flags are matched on raw argv, before `--`. Values of other flags (`--env prod`) count as topic tokens, so put
  `--help` before them or use `app help <command>` when a flag value could be mistaken for a command word.
