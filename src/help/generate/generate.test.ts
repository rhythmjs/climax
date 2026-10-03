import { describe, expect, test } from "bun:test";
import { RhythmCli } from "@rhythmjs/cli";
import { commandHelp } from "../command/command";
import { optionHelp } from "../option/option";
import { generate, usageOf } from "./generate";

describe("usageOf", () => {
  test("renders params, optionals and catch-all", () => {
    expect(usageOf(["run", ":script", ":env?", "**"])).toBe("run <script> [env] [args...]");
  });
});

describe("generate", () => {
  test("collects commands with their fragments", () => {
    const cli = new RhythmCli().command(
      "deploy :environment",
      commandHelp({ summary: "Deploy", examples: ["app deploy prod"] }),
      optionHelp({ name: "force", alias: "f", description: "Skip checks" }),
      () => {},
    );
    const [doc] = generate(cli);
    expect(doc).toMatchObject({
      segments: ["deploy", ":environment"],
      usage: "deploy <environment>",
      summary: "Deploy",
      examples: ["app deploy prod"],
      options: [{ name: "force", alias: "f", description: "Skip checks" }],
    });
  });

  test("middleware options apply only to commands registered after them", () => {
    const cli = new RhythmCli()
      .command("before", () => {})
      .use(optionHelp({ name: "verbose" }))
      .command("after", () => {});
    const docs = generate(cli);
    expect(docs.map((d) => d.options.length)).toEqual([0, 1]);
  });

  test("recurses into mounted clis, carrying inherited options down only", () => {
    const child = new RhythmCli({ prefix: "user" }).command("add :name", () => {});
    const parent = new RhythmCli()
      .use(optionHelp({ name: "json" }))
      .use(child.middleware())
      .command("version", () => {});
    const docs = generate(parent);
    expect(docs.map((d) => d.usage)).toEqual(["user add <name>", "version"]);
    expect(docs.every((d) => d.options.some((o) => o.name === "json"))).toBe(true);

    const sibling = new RhythmCli().use(optionHelp({ name: "child-only" }));
    expect(generate(sibling)).toEqual([]);
  });

  test("hides hidden commands unless asked, and can drop undocumented ones", () => {
    const cli = new RhythmCli()
      .command("secret", commandHelp({ hidden: true }), () => {})
      .command("plain", () => {})
      .command("documented", commandHelp({ summary: "x" }), () => {});
    expect(generate(cli).map((d) => d.usage)).toEqual(["plain", "documented"]);
    expect(generate(cli, { includeHidden: true }).map((d) => d.usage)).toEqual(["secret", "plain", "documented"]);
    expect(generate(cli, { includeUndocumented: false }).map((d) => d.usage)).toEqual(["documented"]);
  });
});
