# @rhythmjs/climax

General-purpose building blocks for [Rhythm](https://github.com/rhythmjs/rhythm) CLIs, one feature per subpath. Today that is **help** (`@rhythmjs/climax/help/*`): `--help`, `-h` and `help [command]` generated from your own command definitions.

It sits on top of `@rhythmjs/cli`. You document commands with small doc-only middlewares (`commandHelp`, `optionHelp`), wrap your `RhythmCli` with `documented(cli)`, and add `helpModule.forRoot()` to the `Rhythm` app that mounts the cli. The module is never handed the cli: like `@rhythmjs/openapi`, it discovers it through the app's `sources`. Each piece has its own subpath; there is no root barrel export.

## Installation

```sh
bun add @rhythmjs/climax @rhythmjs/cli @rhythmjs/rhythm
```

Peer dependencies: `@rhythmjs/cli >=0.0.24` and `@rhythmjs/rhythm >=0.0.24`. Bun `>=1.2.0` is required.

## Using it with Rhythm

```ts
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { RhythmCli } from "@rhythmjs/cli";
import { toCliHandler } from "@rhythmjs/cli/run";
import { commandHelp } from "@rhythmjs/climax/help/command";
import { optionHelp } from "@rhythmjs/climax/help/option";
import { documented } from "@rhythmjs/climax/help/documented";
import { helpModule } from "@rhythmjs/climax/help/module";

const cli = documented(new RhythmCli({ name: "app" })).cmd(
  "deploy :environment",
  commandHelp({ summary: "Deploy the app", examples: ["app deploy prod"] }),
  optionHelp({ name: "force", alias: "f", description: "Skip checks" }),
  (ctx) => ctx.log(`deploying to ${ctx.params.environment}`),
);

const app = new Rhythm().use(helpModule.forRoot({ name: "app", description: "My app" })).use(mount(cli));

process.exitCode = await toCliHandler(app)(Bun.argv.slice(2));
```

```
$ app --help
$ app help deploy
$ app deploy prod -h
```

How the pieces fit:

1. `documented(cli)` wraps a `RhythmCli` so its commands can be read back (a `RhythmCli` does not expose them).
2. `commandHelp(...)` and `optionHelp(...)` are passed as extra handlers to `cmd()` (or to `use()`, see below). They call `next()` and do nothing else; they only carry metadata.
3. `helpModule.forRoot(options)` is a mountable middleware. Add it with `.use(...)` **before** `mount(cli)`: middleware runs in order, and help answers without calling `next()`, so no command runs.
4. `mount(cli)` adds the cli to the app. Startup work (`register(decorate(...))`, `include(...)`) can be added to the same `Rhythm` as usual; it runs before any of the above.
5. `toCliHandler(app)` turns the app into `(argv) => Promise<number>`.

What ends up on `ctx`: the module adds nothing for your commands. When it answers help, it logs through `ctx.log`, sets `ctx.exitCode = 1` for an unknown topic, and sets `ctx.params = {}` so `toCliHandler` treats the command as handled instead of reporting "unknown command".

Mounting a child cli works the same way, and the child must be documented too:

```ts
const db = documented(new RhythmCli()).cmd("db migrate", commandHelp({ summary: "Run migrations" }), (ctx) =>
  log(ctx, "migrating"),
);

const cli = documented(new RhythmCli({ name: "app" })).use(mount(db));
```

## API reference

### `documented(cli)` from `@rhythmjs/climax/help/documented`

Returns the same cli, typed `C & CliSource`. It records every `cmd()` and `use()` call, in order, as `entries` (the shape `generate()` and the help module discover through the app's `sources`). A cli that is not wrapped is invisible to help, including mounted children.

### `commandHelp(options)` from `@rhythmjs/climax/help/command`

Returns a doc-only middleware. `options` is `CommandHelpOptions` (an alias of `CommandFields`):

- `summary?: string`: one line shown in lists and on the command page.
- `description?: string`: longer text on the command page.
- `examples?: readonly string[]`: rendered as `$ <example>` lines.
- `deprecated?: boolean | string`: `true` or a message.
- `hidden?: boolean`: leave the command out of help (see `includeHidden`).

### `optionHelp(options)` from `@rhythmjs/climax/help/option`

Returns a doc-only middleware. `options` is `OptionHelpOptions` (an alias of `OptionSpec`):

- `name: string` (shown as `--name`), `alias?: string` (shown as `-x`).
- `description?: string`.
- `type?: string`: value placeholder, shown as `<type>`.
- `required?: boolean`, `default?: unknown` (shown as a note, the default is JSON-encoded).

`optionHelp` only documents a flag. It does not parse anything; pair it with `withParsedArgv()` from `@rhythmjs/cli/argv` to read the flag.

### `helpModule.forRoot(options?)` from `@rhythmjs/climax/help/module`

`HelpOptions`:

- `name?: string`: program name in usage lines.
- `description?: string`: shown at the top of the index.
- `command?: string | false`: the help command word, `"help"` by default; `false` keeps only the `--help` / `-h` flags.
- `includeUndocumented?: boolean`: list commands with no `commandHelp` / `optionHelp` (default `true`).
- `includeHidden?: boolean`: list commands marked `hidden` (default `false`).

The returned middleware also carries `helpService`, with `commands(): readonly CommandDoc[]` (structured docs for custom renderers) and `render(topic?: readonly string[]): string[]` (the output lines).

### Lower-level pieces

- `@rhythmjs/climax/help/generate`: `generate(clis, options?)` builds `CommandDoc[]` from one or more `CliSource`s; also `isCliSource`, `usageOf`, and the `CliSource`, `CommandDoc`, `GenerateOptions` types.
- `@rhythmjs/climax/help/render`: `render(docs, topic, options?)`, `renderIndex`, `renderGroup`, `renderCommand`, `resolve`, and the `RenderOptions` and `Resolved` types.
- `@rhythmjs/climax/help/metadata`: `docOnly`, `withFragment`, `fragmentOf`, `HELP_METADATA` and the `CommandFields`, `OptionSpec`, `HelpFragment` types, for writing your own doc-only middlewares.

## Behavior and gotchas

- **Wrap every cli with `documented()`**, including mounted children. Only documented clis are walked; undocumented ones silently contribute no help.
- **Discovery** uses the app the module is `use()`d in (its parent's `sources`). Documented clis mounted into it, and documented clis mounted into those, are walked recursively. Using the module outside an app throws a clear error. Docs are computed once, on first use.
- **Order matters**: `.use(helpModule.forRoot(...))` must come before `.use(mount(cli))`.
- **Topics**: `help` / `--help` prints the command index. A full command prints usage, summary, description, options and examples. A prefix (`app user --help`) lists that group's subcommands. An unknown topic prints the index and exits 1.
- **Options inherit by order**: `optionHelp` passed to `cli.use(...)` applies to the commands registered after it (and to mounted child clis), never to earlier commands or the parent. Passed as a command handler it applies to that command only.
- **Argv matching is raw**: flags are matched on argv before `--`. Values of other flags (`--env prod`) count as topic tokens, so put `--help` before them or use `app help <command>` when a flag value could be mistaken for a command word.
- Usage lines come from the command string: `:name` renders as `<name>`, `:name?` as `[name]`, and `**` as `[args...]`.

## Testing your app

Capture output with the `io` argument of `toCliHandler` and assert on the text and exit code:

```ts
import { expect, test } from "bun:test";
import { toCliHandler } from "@rhythmjs/cli/run";

test("help lists deploy", async () => {
  const out: string[] = [];
  const io = { stdout: { write: (text: string) => out.push(text) }, stderr: { write: () => {} } };

  const exitCode = await toCliHandler(app, io)(["--help"]);

  expect(exitCode).toBe(0);
  expect(out.join("")).toContain("deploy <environment>  Deploy the app");
});
```

Here `app` is the `Rhythm` app from the example above. To assert on structured docs instead, keep the module in a variable (`const help = helpModule.forRoot(...)`), `.use(help)` it, and call `help.helpService.commands()`.
