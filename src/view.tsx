import React, { useEffect, useReducer } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import { current, initial, reduce, visible, type Action, type Effect, type State } from "./board.js";
import { ageDays, isStale, type Item } from "./model.js";
import * as bd from "./bd.js";
import * as gh from "./gh.js";

const TRADE: Record<string, string> = {
  bug: "🔧",
  feature: "🔨",
  task: "🪚",
  chore: "🧹",
  epic: "📐",
  decision: "📋",
  spike: "🔦",
  story: "📝",
  milestone: "🏁",
  inspector: "🧑‍💼",
};
const STATUS: Record<string, string> = {
  open: "○",
  in_progress: "◐",
  blocked: "●",
  draft: "✎",
  review: "👀",
  approved: "✓",
};

async function load(): Promise<Item[]> {
  const [beads, prs] = await Promise.all([bd.listBeads(), gh.listPrs()]);
  return [...beads, ...prs];
}

async function perform(fx: Effect, dispatch: (a: Action) => void, exit: () => void) {
  const say = (text: string) => dispatch({ type: "msg", text });
  try {
    switch (fx.type) {
      case "refresh":
        dispatch({ type: "loaded", items: await load() });
        break;
      case "claim":
        await bd.claim(fx.id);
        say(`${fx.id} on the tools`);
        break;
      case "close":
        await bd.close(fx.id, fx.reason);
        say(`${fx.id} knocked off`);
        break;
      case "note":
        await bd.note(fx.id, fx.text);
        say(`${fx.id} noted`);
        break;
      case "merge":
        await gh.merge(fx.id);
        say(`${fx.id} certified`);
        break;
      case "show":
        dispatch({
          type: "detail",
          text: fx.item.kind === "bead" ? await bd.show(fx.item.id) : await gh.view(fx.item.id),
        });
        break;
      case "quit":
        exit();
        break;
    }
  } catch (e) {
    say(`strewth: ${(e as Error).message.split("\n")[0]}`);
  }
}

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [s, dispatch] = useReducer((st: State, a: Action) => {
    const [next, fx] = reduce(st, a);
    for (const f of fx) void perform(f, dispatch, exit);
    return next;
  }, initial);

  useEffect(() => {
    void perform({ type: "refresh" }, dispatch, exit);
    const t = setInterval(() => void perform({ type: "refresh" }, dispatch, exit), 30_000);
    return () => clearInterval(t);
  }, []);

  useInput((input, key) => {
    if (s.mode === "note" || s.mode === "close") {
      if (key.escape) dispatch({ type: "key", key: "escape" });
      return;
    }
    const name = key.return
      ? "return"
      : key.tab
        ? "tab"
        : key.upArrow
          ? "up"
          : key.downArrow
            ? "down"
            : key.escape
              ? "escape"
              : input;
    dispatch({ type: "key", key: name });
  });

  if (s.mode === "detail") {
    const rows = (stdout?.rows ?? 40) - 2;
    return (
      <Box flexDirection="column">
        <Text>{s.detail.split("\n").slice(0, rows).join("\n")}</Text>
        <Text dimColor>any key to go back</Text>
      </Box>
    );
  }

  const items = visible(s);
  const rows = Math.max(5, (stdout?.rows ?? 40) - 4);
  const top = Math.max(0, Math.min(s.cursor - Math.floor(rows / 2), items.length - rows));
  const it = current(s);
  const stale = s.items.filter((i) => isStale(i)).length;

  return (
    <Box flexDirection="column">
      <Text bold>
        🏗 job board <Text dimColor>{s.filter}</Text> {s.items.length} on site
        {stale ? <Text color="yellow"> 🐕 {stale} on smoko too long</Text> : null}
      </Text>
      {items.slice(top, top + rows).map((i, n) => (
        <Row key={i.id} item={i} on={top + n === s.cursor} />
      ))}
      {s.mode === "list" ? (
        <Text dimColor>
          {s.msg || "j/k move  ⏎ show  c claim  n note  x close  m merge  tab filter  r refresh  q quit"}
        </Text>
      ) : (
        <Box>
          <Text color="cyan">{s.mode === "close" ? `close ${it?.id}, reason: ` : `note on ${it?.id}: `}</Text>
          <TextInput
            value={s.input}
            onChange={(v) => dispatch({ type: "input", value: v })}
            onSubmit={() => dispatch({ type: "submit" })}
          />
        </Box>
      )}
    </Box>
  );
}

function Row({ item, on }: { item: Item; on: boolean }) {
  const age = ageDays(item);
  const stale = isStale(item);
  const colour = item.blocked ? "red" : stale ? "yellow" : item.priority === 0 ? "magenta" : undefined;
  return (
    <Text inverse={on} color={colour}>
      {` ${STATUS[item.status] ?? "·"} P${item.priority} ${TRADE[item.trade] ?? "🛠"} ${item.id.padEnd(14)} ${item.title.slice(0, 80).padEnd(80)} ${String(age + "d").padStart(4)} ${item.labels.join(",")}`}
    </Text>
  );
}
