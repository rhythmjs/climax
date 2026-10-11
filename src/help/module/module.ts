import { Pipeline, withSource, type MountMiddleware, type Next } from "@rhythmjs/rhythm";
import type { RhythmCliContext } from "@rhythmjs/cli/context";
import { generate, isCliSource, type CommandDoc, type GenerateOptions } from "../generate/generate";
import { render, resolve, type RenderOptions } from "../render/render";
import { log } from "@rhythmjs/cli/output";

export interface HelpOptions extends GenerateOptions, RenderOptions {
  command?: string | false;
}

export interface HelpService {
  commands(): readonly CommandDoc[];
  render(topic?: readonly string[]): string[];
}

const HELP_FLAGS = new Set(["--help", "-h"]);

function positionalsOf(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (const token of argv) {
    if (token === "--") break;
    if (!token.startsWith("-")) out.push(token);
  }
  return out;
}

function optionsOf(argv: readonly string[]): readonly string[] {
  const end = argv.indexOf("--");
  return end === -1 ? argv : argv.slice(0, end);
}

class HelpSource extends Pipeline<RhythmCliContext> {
  override callback() {
    return async () => {};
  }
}

export const helpModule = {
  forRoot(options: HelpOptions = {}) {
    const { command = "help", name, description, ...generateOptions } = options;
    const renderOptions: RenderOptions = { name, description };
    const source = new HelpSource({ name: "help", type: "module" });

    let cached: readonly CommandDoc[] | undefined;
    const helpService: HelpService = {
      commands() {
        if (!cached) {
          const scope = source.parent;
          if (!scope) {
            throw new Error("helpModule documents the app it is used in: add it with app.use(helpModule.forRoot(...))");
          }
          cached = generate(scope.sources.filter(isCliSource), generateOptions);
        }
        return cached;
      },
      render(topic = []) {
        return render(helpService.commands(), topic, renderOptions);
      },
    };

    const middleware = async (ctx: RhythmCliContext, next: Next) => {
      const flagged = optionsOf(ctx.argv).some((token) => HELP_FLAGS.has(token));
      const positionals = positionalsOf(ctx.argv);
      const asCommand = command !== false && positionals[0] === command;
      if (!flagged && !asCommand) {
        await next();
        return;
      }

      const topic = asCommand ? positionals.slice(1) : positionals;
      const docs = helpService.commands();
      for (const line of helpService.render(topic)) log(ctx, line);
      if (resolve(docs, topic).kind === "none") ctx.exitCode = 1;
      // `params` marks the command as handled for toCliHandler, which otherwise reports "unknown command".
      Object.assign(ctx, { params: {} });
    };

    return Object.assign(withSource(middleware, source) as MountMiddleware<RhythmCliContext>, { helpService });
  },
};
