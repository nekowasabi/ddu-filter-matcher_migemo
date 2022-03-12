import {
  BaseFilter,
  DduItem,
  SourceOptions,
} from "https://deno.land/x/ddu_vim@v1.1.0/types.ts";
import { Denops } from "https://deno.land/x/ddu_vim@v1.1.0/deps.ts";
import {
  ensureArray,
  ensureString,
} from "https://deno.land/x/unknownutil@v1.1.4/mod.ts";
import { globals } from "https://deno.land/x/denops_std/variable/mod.ts";

type Params = {
  highlightMatched: string;
};

function charposToBytepos(input: string, pos: number): number {
  return (new TextEncoder()).encode(input.slice(0, pos)).length;
}

export class Filter extends BaseFilter<Params> {
  async filter(args: {
    denops: Denops;
    sourceOptions: SourceOptions;
    filterParams: Params;
    input: string;
    items: DduItem[]; // 候補
  }): Promise<DduItem[]> {
    if (args.input == "") {
      // DenopsはPromise型のなにかを返却する仕様
      return Promise.resolve(args.items);
    }

    // if (/.*P$/.test(args.input)) {
    //   return Promise.resolve(args.items);
    // }

    const migemo_dict = await globals.get(args.denops, "migemo_dict");
    ensureString(migemo_dict);

    const cmd = Deno.run({
      cmd: ["cmigemo", "-w", args.input, "-d", migemo_dict],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    const output = await cmd.output();

    const decoder = new TextDecoder();
    const inputs = [decoder.decode(output)];
    ensureArray(inputs);

    let items = args.items;

    for (const subInput of inputs) {
      items = items.filter((item) => {
        const ret = item.matcherKey.search(
          subInput.replaceAll("+", "\\+").slice(0, -2),
        );

        if (ret !== -1) return item;
      });
    }

    if (args.filterParams.highlightMatched == "") {
      return Promise.resolve(items);
    }

    return Promise.resolve(
      items.map(
        (item) => {
          const display = item.display ?? item.word;
          const matcherKey = display;
          const highlights =
            item.highlights?.filter((hl) => hl.name != "matched") ?? [];

          for (const subInput of inputs) {
            const start = matcherKey.search(
              subInput.replaceAll("+", "\\+").slice(0, -2),
            );

            if (start >= 0) {
              highlights.push({
                name: "matched",
                "hl_group": args.filterParams.highlightMatched,
                col: charposToBytepos(matcherKey, start) + 1,
                width: (new TextEncoder()).encode(subInput).length,
              });
            }
          }

          return {
            ...item,
            highlights: highlights,
          };
        },
      ),
    );
  }

  params(): Params {
    return {
      highlightMatched: "Matched",
    };
  }
}
