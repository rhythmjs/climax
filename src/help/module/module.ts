import { Rhythm } from "@rhythmjs/rhythm";
import type { RhythmCliContext } from "@rhythmjs/cli/context";
import { generate, isCliSource, type CommandDoc, type GenerateOptions } from "../generate/generate";
import { render, resolve, type RenderOptions } from "../render/render";

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

export const helpModule = {
  forRoot(options: HelpOptions = {}) {
    const { command = "help", name, description, ...generateOptions } = options;
    const renderOptions: RenderOptions = { name, description };

    let cached: readonly CommandDoc[] | undefined;
    const helpService: HelpService = {
      commands() {
        if (!cached) {
          const scope = module.parent;
          if (!scope) {
            throw new Error(
              "helpModule documents the app it is registered in: add it with app.register(helpModule.forRoot(...))",
            );
          }
          cached = generate(scope.sources.filter(isCliSource), generateOptions);
        }
        return cached;
      },
      render(topic = []) {
        return render(helpService.commands(), topic, renderOptions);
      },
    };

    const module = new Rhythm<RhythmCliContext, { helpService: HelpService }>({ type: "module", name: "help" });
    module.context.helpService = helpService;
    return module.use(async (ctx, next) => {
      const flagged = optionsOf(ctx.argv).some((token) => HELP_FLAGS.has(token));
      const positionals = positionalsOf(ctx.argv);
      const asCommand = command !== false && positionals[0] === command;
      if (!flagged && !asCommand) {
        await next();
        return;
      }

      const topic = asCommand ? positionals.slice(1) : positionals;
      const docs = helpService.commands();
      for (const line of helpService.render(topic)) ctx.response.print(line);
      if (resolve(docs, topic).kind === "none") ctx.response.exit(1);
    });
  },
};
