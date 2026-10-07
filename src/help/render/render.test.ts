import { describe, expect, test } from "bun:test";
import { RhythmCli } from "@rhythmjs/cli";
import { documented } from "../documented/documented";
import { commandHelp } from "../command/command";
import { generate } from "../generate/generate";
import { optionHelp } from "../option/option";
import { render, resolve } from "./render";

const cli = documented(new RhythmCli())
  .cmd(
    "deploy :environment",
    commandHelp({ summary: "Deploy the app", description: "Ships it.", examples: ["app deploy prod"] }),
    optionHelp({ name: "force", alias: "f", type: "boolean", description: "Skip checks", default: false }),
    () => {},
  )
  .cmd("user add :name", commandHelp({ summary: "Add a user", deprecated: "use invite" }), () => {})
  .cmd("user remove :name", () => {});
const docs = generate(cli);

describe("resolve", () => {
  test("distinguishes index, command, group and unknown", () => {
    expect(resolve(docs, []).kind).toBe("index");
    expect(resolve(docs, ["deploy", "prod"]).kind).toBe("command");
    expect(resolve(docs, ["deploy"]).kind).toBe("command");
    expect(resolve(docs, ["user"]).kind).toBe("group");
    expect(resolve(docs, ["nope"]).kind).toBe("none");
  });
});

describe("render", () => {
  test("index lists every command with summaries", () => {
    const text = render(docs, [], { name: "app", description: "My app" }).join("\n");
    expect(text).toContain("My app");
    expect(text).toContain("Usage: app <command> [options]");
    expect(text).toContain("deploy <environment>  Deploy the app");
    expect(text).toContain("user add <name>");
    expect(text).toContain("(deprecated: use invite)");
  });

  test("command shows usage, options and examples", () => {
    const text = render(docs, ["deploy", "prod"], { name: "app" }).join("\n");
    expect(text).toContain("Usage: app deploy <environment> [options]");
    expect(text).toContain("Ships it.");
    expect(text).toContain("-f, --force <boolean>  Skip checks (default: false)");
    expect(text).toContain("$ app deploy prod");
  });

  test("group lists only the matching subcommands", () => {
    const text = render(docs, ["user"], { name: "app" }).join("\n");
    expect(text).toContain("Usage: app user <command> [options]");
    expect(text).toContain("user remove <name>");
    expect(text).not.toContain("deploy");
  });

  test("unknown topic reports and falls back to the index", () => {
    const text = render(docs, ["nope"]).join("\n");
    expect(text).toStartWith("Unknown command: nope");
    expect(text).toContain("Commands:");
  });
});
