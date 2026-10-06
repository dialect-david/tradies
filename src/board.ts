import { byUrgency, type Item } from "./model.js";

export type Mode = "list" | "note" | "close" | "detail";

export type State = {
  items: Item[];
  cursor: number;
  mode: Mode;
  input: string;
  detail: string;
  msg: string;
  filter: "all" | "beads" | "prs";
};

export type Effect =
  | { type: "claim"; id: string }
  | { type: "close"; id: string; reason: string }
  | { type: "note"; id: string; text: string }
  | { type: "show"; item: Item }
  | { type: "merge"; id: string }
  | { type: "refresh" }
  | { type: "quit" };

export type Action =
  | { type: "key"; key: string }
  | { type: "input"; value: string }
  | { type: "submit" }
  | { type: "loaded"; items: Item[] }
  | { type: "detail"; text: string }
  | { type: "msg"; text: string };

export const initial: State = {
  items: [],
  cursor: 0,
  mode: "list",
  input: "",
  detail: "",
  msg: "",
  filter: "all",
};

export function visible(s: State): Item[] {
  const pick =
    s.filter === "all" ? s.items : s.items.filter((i) => (s.filter === "prs") === (i.kind === "pr"));
  return [...pick].sort(byUrgency);
}

export function current(s: State): Item | undefined {
  return visible(s)[s.cursor];
}

export function reduce(s: State, a: Action): [State, Effect[]] {
  switch (a.type) {
    case "loaded":
      return [{ ...s, items: a.items, cursor: Math.min(s.cursor, Math.max(0, a.items.length - 1)) }, []];
    case "detail":
      return [{ ...s, mode: "detail", detail: a.text }, []];
    case "msg":
      return [{ ...s, msg: a.text }, []];
    case "input":
      return [{ ...s, input: a.value }, []];
    case "submit": {
      const it = current(s);
      if (!it || !s.input.trim()) return [{ ...s, mode: "list", input: "" }, []];
      const fx: Effect[] =
        s.mode === "note"
          ? [{ type: "note", id: it.id, text: s.input }]
          : [{ type: "close", id: it.id, reason: s.input }];
      return [{ ...s, mode: "list", input: "" }, [...fx, { type: "refresh" }]];
    }
    case "key":
      return key(s, a.key);
  }
}

function key(s: State, k: string): [State, Effect[]] {
  const n = visible(s).length;
  const it = current(s);
  if (s.mode === "detail") return [{ ...s, mode: "list" }, []];
  if (s.mode !== "list") return k === "escape" ? [{ ...s, mode: "list", input: "" }, []] : [s, []];
  switch (k) {
    case "j":
    case "down":
      return [{ ...s, cursor: n ? (s.cursor + 1) % n : 0 }, []];
    case "k":
    case "up":
      return [{ ...s, cursor: n ? (s.cursor - 1 + n) % n : 0 }, []];
    case "g":
      return [{ ...s, cursor: 0 }, []];
    case "G":
      return [{ ...s, cursor: Math.max(0, n - 1) }, []];
    case "tab":
      return [
        { ...s, filter: s.filter === "all" ? "beads" : s.filter === "beads" ? "prs" : "all", cursor: 0 },
        [],
      ];
    case "r":
      return [s, [{ type: "refresh" }]];
    case "q":
      return [s, [{ type: "quit" }]];
    case "return":
      return it ? [s, [{ type: "show", item: it }]] : [s, []];
    case "c":
      return it?.kind === "bead" ? [s, [{ type: "claim", id: it.id }, { type: "refresh" }]] : [s, []];
    case "x":
      return it?.kind === "bead" ? [{ ...s, mode: "close", input: "" }, []] : [s, []];
    case "n":
      return it?.kind === "bead" ? [{ ...s, mode: "note", input: "" }, []] : [s, []];
    case "m":
      return it?.kind === "pr" ? [s, [{ type: "merge", id: it.id }, { type: "refresh" }]] : [s, []];
  }
  return [s, []];
}
