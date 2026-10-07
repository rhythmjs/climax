import { describe, expect, test } from "bun:test";
import { mount } from "@rhythmjs/rhythm";
import { RhythmCli } from "@rhythmjs/cli";
import { documented } from "../documented/documented";
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
    const cli = documented(new RhythmCli()).cmd(
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
    const cli = documented(new RhythmCli())
      .cmd("before", () => {})
      .use(optionHelp({ name: "verbose" }))
      .cmd("after", () => {});
    const docs = generate(cli);
    expect(docs.map((d) => d.options.length)).toEqual([0, 1]);
  });

  test("recurses into mounted clis, carrying inherited options down only", () => {
    const child = documented(new RhythmCli()).cmd("user add :name", () => {});
    const parent = documented(new RhythmCli())
      .use(optionHelp({ name: "json" }))
      .use(mount(child))
      .cmd("version", () => {});
    const docs = generate(parent);
    expect(docs.map((d) => d.usage)).toEqual(["user add <name>", "version"]);
    expect(docs.every((d) => d.options.some((o) => o.name === "json"))).toBe(true);

    const sibling = documented(new RhythmCli()).use(optionHelp({ name: "child-only" }));
    expect(generate(sibling)).toEqual([]);
  });

  test("hides hidden commands unless asked, and can drop undocumented ones", () => {
    const cli = documented(new RhythmCli())
      .cmd("secret", commandHelp({ hidden: true }), () => {})
      .cmd("plain", () => {})
      .cmd("documented", commandHelp({ summary: "x" }), () => {});
    expect(generate(cli).map((d) => d.usage)).toEqual(["plain", "documented"]);
    expect(generate(cli, { includeHidden: true }).map((d) => d.usage)).toEqual(["secret", "plain", "documented"]);
    expect(generate(cli, { includeUndocumented: false }).map((d) => d.usage)).toEqual(["documented"]);
  });
});
