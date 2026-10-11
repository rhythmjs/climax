import { describe, expect, test } from "bun:test";
import { Rhythm, mount } from "@rhythmjs/rhythm";
import { RhythmCli } from "@rhythmjs/cli";
import { toCliHandler } from "@rhythmjs/cli/run";
import { documented } from "../documented/documented";
import { commandHelp } from "../command/command";
import { helpModule } from "./module";
import { log } from "@rhythmjs/cli/output";

function build(options = {}) {
  const cli = documented(new RhythmCli()).cmd(
    "deploy :environment",
    commandHelp({ summary: "Deploy the app" }),
    (ctx) => {
      log(ctx, `deploying ${ctx.params.environment}`);
    },
  );
  const app = new Rhythm().use(helpModule.forRoot({ name: "app", ...options })).use(mount(cli));
  return async (argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const io = {
      stdout: { write: (text: string) => out.push(text) },
      stderr: { write: (text: string) => err.push(text) },
    };
    const exitCode = await toCliHandler(app, io)(argv);
    return { stdout: out.join(""), stderr: err, exitCode };
  };
}

describe("helpModule", () => {
  test("--help prints the index", async () => {
    const ctx = await build()(["--help"]);
    expect(ctx.stdout).toContain("deploy <environment>  Deploy the app");
    expect(ctx.exitCode).toBe(0);
  });

  test("help <command> and <command> --help print command help", async () => {
    for (const argv of [
      ["help", "deploy", "prod"],
      ["deploy", "prod", "-h"],
    ]) {
      const ctx = await build()(argv);
      expect(ctx.stdout).toContain("Usage: app deploy <environment>");
    }
  });

  test("unknown topic exits 1", async () => {
    const ctx = await build()(["help", "nope"]);
    expect(ctx.exitCode).toBe(1);
    expect(ctx.stderr).toEqual([]);
  });

  test("other argv falls through to the cli", async () => {
    const ctx = await build()(["deploy", "prod"]);
    expect(ctx.stdout).toBe("deploying prod\n");
  });

  test("the help command can be disabled", async () => {
    const ctx = await build({ command: false })(["help"]);
    expect(ctx.stdout).toBe("");
  });

  test("throws when not used in an app", () => {
    const module = helpModule.forRoot();
    expect(() => module.helpService.commands()).toThrow(/used in/);
  });
});
