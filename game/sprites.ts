export type Pixels = { rows: string[]; palette: Record<string, string> };

const outline = "#1a1a1a";
const skin = "#f1c27d";
const vis = "#ff8c1a";
const stripe = "#e8e8e8";
const shorts = "#2c3e50";
const boots = "#3b2a1a";

export const TRADIE_PALETTE = { o: outline, s: skin, v: vis, V: stripe, b: shorts, k: boots };

export const TRADIE_FRAMES: string[][] = [
  [
    "...HHHHHH...",
    "..HHHHHHHH..",
    ".HHHHHHHHHH.",
    "..ssssssss..",
    "..soss.soss.",
    "..ssssssss..",
    "...ssssss...",
    "..vvvvvvvv..",
    ".vvvvvvvvvv.",
    ".sVVVVVVVVs.",
    ".svvvvvvvvs.",
    "...vvvvvv...",
    "...bbbbbb...",
    "...bbbbbb...",
    "...bb..bb...",
    "...ss..ss...",
    "...ss..ss...",
    "...kk..kk...",
    "..kkk..kkk..",
  ],
  [
    "...HHHHHH...",
    "..HHHHHHHH..",
    ".HHHHHHHHHH.",
    "..ssssssss..",
    "..soss.soss.",
    "..ssssssss..",
    "...ssssss...",
    "..vvvvvvvv..",
    ".vvvvvvvvvv.",
    ".sVVVVVVVVs.",
    ".svvvvvvvvs.",
    "...vvvvvv...",
    "...bbbbbb...",
    "..bbbbbbbb..",
    "..bb....bb..",
    ".ss......ss.",
    ".ss......ss.",
    ".kk......kk.",
    "kkk......kkk",
  ],
  [
    "...HHHHHH...",
    "..HHHHHHHH..",
    ".HHHHHHHHHH.",
    "..ssssssss..",
    "..soss.soss.",
    "..ssssssss..",
    "...ssssss...",
    "..vvvvvvvv..",
    ".vvvvvvvvvv.",
    ".sVVVVVVVVs.",
    ".svvvvvvvvs.",
    "...vvvvvv...",
    "...bbbbbbbb.",
    "...bbbbbbbbb",
    "........ssss",
    "........kkkk",
    "............",
    "............",
    "............",
  ],
];

export const KELPIE_PALETTE = { o: outline, r: "#9b5a2a", d: "#6b3a14", t: "#d9a066", w: "#ffffff" };

export const KELPIE_FRAMES: string[][] = [
  [
    "..............rr",
    ".............rrr",
    "..rr.......rrrro",
    "..rrrrrrrrrrrrr.",
    "...rrrrrrrrrrr..",
    "...rrrrrrrrrrt..",
    "...dd......dd...",
    "...d........d...",
  ],
  [
    ".............rr.",
    "............rrr.",
    ".rr........rrrro",
    "..rrrrrrrrrrrrr.",
    "...rrrrrrrrrrr..",
    "...rrrrrrrrrrt..",
    "..dd........dd..",
    ".d............d.",
  ],
  [
    "..............rr",
    ".............rrr",
    "...........rrrro",
    "..r......rrrrrr.",
    "..rr...rrrrrrr..",
    "..rrrrrrrrrrrt..",
    "...rrrrrrrrdd...",
    "...dd.......d...",
  ],
  [
    "................",
    "................",
    "................",
    "..rr............",
    "..rrrrrrrrrrrr..",
    "...rrrrrrrrrrrro",
    "...rrrrrrrrrrrr.",
    "...dd......dd...",
  ],
];

export function frameSize(frames: string[][]): { w: number; h: number } {
  const h = frames[0]!.length;
  const w = frames[0]![0]!.length;
  for (const f of frames)
    if (f.length !== h || f.some((r) => r.length !== w)) throw new Error("ragged frame");
  return { w, h };
}

export function paint(
  ctx: CanvasRenderingContext2D,
  frames: string[][],
  palette: Record<string, string>,
  scale: number,
): { w: number; h: number } {
  const { w, h } = frameSize(frames);
  frames.forEach((rows, f) =>
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const c = palette[ch];
        if (!c) return;
        ctx.fillStyle = c;
        ctx.fillRect((f * w + x) * scale, y * scale, scale, scale);
      }),
    ),
  );
  return { w, h };
}

export const STAGES = ["site", "slab", "frame", "roof", "lockup", "fitout", "done"] as const;
export type Stage = (typeof STAGES)[number];

export function stage(closed: number, open: number): Stage {
  const total = closed + open;
  if (!total) return "site";
  if (!open) return "done";
  return STAGES[Math.min(5, Math.floor((closed / total) * 6))]!;
}

export const SLAB_PALETTE = { o: outline, c: "#c8963e", d: "#a3772c", g: "#ffd700", w: "#ffffff" };
export const SLAB_FRAMES: string[][] = [
  [
    "oooooooooooooooooooooo",
    "occccccccccccccccccccо".replace("о", "o"),
    "ocddddddddddddddddddco",
    "ocdggggggggggggggggdco",
    "ocdgwwgwgwwgwgwwgwgdco",
    "ocdggggggggggggggggdco",
    "ocddddddddddddddddddco",
    "occccccccccccccccccccо".replace("о", "o"),
    "oooooooooooooooooooooo",
  ],
];

export const CAN_PALETTE = { o: outline, g: "#2e8b57", s: "#cfcfcf", y: "#ffd700" };
export const CAN_FRAMES: string[][] = [["osso", "oggo", "oyyo", "oggo", "oggo", "osso"]];

export const SLAB_SIZE = 24;

export function slabs(closed: number): { slabs: number; cans: number } {
  return { slabs: Math.floor(closed / SLAB_SIZE), cans: closed % SLAB_SIZE };
}
