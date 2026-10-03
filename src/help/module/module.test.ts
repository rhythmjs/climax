import { describe, expect, test } from "bun:test";
import { Rhythm } from "@rhythmjs/rhythm";
import { RhythmCli } from "@rhythmjs/cli";
import { RhythmCliResponse, type RhythmCliContext } from "@rhythmjs/cli/context";
import { commandHelp } from "../command/command";
import { helpModule } from "./module";

function build(options = {}) {
  const cli = new RhythmCli().command("deploy :environment", commandHelp({ summary: "Deploy the app" }), (ctx) => {
    ctx.response.print(`deploying ${ctx.args.environment}`);
  });
  const app = new Rhythm<RhythmCliContext>()
    .register(helpModule.forRoot({ name: "app", ...options }))
    .use(cli.middleware());
  const run = app.callback();
  return (argv: string[]) => run({ argv, flags: {}, stdin: null, response: new RhythmCliResponse() });
}

describe("helpModule", () => {
  test("--help prints the index", async () => {
    const ctx = await build()(["--help"]);
    expect(ctx.response.stdout.join("\n")).toContain("deploy <environment>  Deploy the app");
    expect(ctx.response.exitCode).toBe(0);
  });

  test("help <command> and <command> --help print command help", async () => {
    for (const argv of [
      ["help", "deploy", "prod"],
      ["deploy", "prod", "-h"],
    ]) {
      const ctx = await build()(argv);
      expect(ctx.response.stdout.join("\n")).toContain("Usage: app deploy <environment>");
    }
  });

  test("unknown topic exits 1", async () => {
    const ctx = await build()(["help", "nope"]);
    expect(ctx.response.exitCode).toBe(1);
    expect(ctx.response.stderr).toEqual([]);
  });

  test("other argv falls through to the cli", async () => {
    const ctx = await build()(["deploy", "prod"]);
    expect(ctx.response.stdout).toEqual(["deploying prod"]);
  });

  test("the help command can be disabled", async () => {
    const ctx = await build({ command: false })(["help"]);
    expect(ctx.response.stdout).toEqual([]);
  });

  test("throws when not registered in an app", () => {
    const module = helpModule.forRoot();
    expect(() => module.context.helpService.commands()).toThrow(/registered in/);
  });
});
