import { CONE_FRAMES, CONE_PALETTE } from "./sprites.ts";

export type Theme = {
  name: string;
  emoji: string;
  sky: string;
  sun: number;
  moon: boolean;
  stars: boolean;
  cloudTint: number;
  grassTint: number;
  dirtTint: number;
  road: number;
  paint: number[];
  tradie: Record<string, string>;
  kelpie: Record<string, string>;
  ute: Record<string, string>;
  car: Record<string, string>;
  hazard: { frames: string[][]; palette: Record<string, string> };
  /** Things in the air: a sheet of 2 frames each, drifting across the sky. */
  critters: Critter[];
};

export type Critter = {
  key: string;
  frames: string[][];
  palette: Record<string, string>;
  count: number;
  alpha: number;
  /** Seconds to cross the screen. */
  cross: [number, number];
  /** Vertical band as a share of the ground height. */
  band: [number, number];
  /** Bob amplitude in px and flap interval in ms. */
  bob: number;
  flap: number;
};

const GHOST_FRAMES: string[][] = [
  [
    "....oooo....",
    "..oowwwwoo..",
    ".owwwwwwwwo.",
    ".owwowwowwo.",
    ".owwowwowwo.",
    "owwwwwwwwwwo",
    "owwwwoowwwwo",
    "owwwwwwwwwwo",
    "owwwwwwwwwwo",
    "owwwwwwwwwwo",
    "owwowwowwowo",
    "ow.oww.ow.wo",
    "o...o...o..o",
  ],
  [
    "....oooo....",
    "..oowwwwoo..",
    ".owwwwwwwwo.",
    ".owwowwowwo.",
    ".owwowwowwo.",
    "owwwwwwwwwwo",
    "owwwwoowwwwo",
    "owwwwwwwwwwo",
    "owwwwwwwwwwo",
    "owwwwwwwwwwo",
    "owowwowwowwo",
    "ow.wo.wwo.wo",
    "o..o...o...o",
  ],
];
const BAT_FRAMES: string[][] = [
  [
    "o.........o.",
    "oo...oo..oo.",
    ".ooooooooo..",
    "..oooeoeo...",
    "....ooooo...",
    "............",
  ],
  [
    "............",
    "............",
    "..oooooooo..",
    "oooooeoeoooo",
    "oo..ooooo.oo",
    "o....ooo...o",
  ],
];


const PUMPKIN_FRAMES: string[][] = [
  ["...gg...", ".oocooo.", "occwccwo", "occcccco", "ocwcccwo", "occwwwco", ".occcco.", "..oooo.."],
];

export const THEMES: Record<string, Theme> = {
  default: {
    name: "default",
    emoji: "🏗",
    sky: "#87ceeb",
    sun: 0xffe066,
    moon: false,
    stars: false,
    cloudTint: 0xffffff,
    grassTint: 0xffffff,
    dirtTint: 0xffffff,
    road: 0x4a4a4a,
    paint: [0xffffff, 0xf7e7c6, 0xd9efe0, 0xdfe7f5, 0xf5dede, 0xefe3f7],
    tradie: {},
    kelpie: {},
    ute: {},
    car: {},
    hazard: { frames: CONE_FRAMES, palette: CONE_PALETTE },
    critters: [],
  },
  halloween: {
    name: "halloween",
    emoji: "🎃",
    sky: "#160c26",
    sun: 0xf4f1d0,
    moon: true,
    stars: true,
    cloudTint: 0x5a4a7a,
    grassTint: 0x7a8a5a,
    dirtTint: 0x6a5a6a,
    road: 0x2a2a33,
    paint: [0x6b5b7b, 0x4f4f5f, 0x7a4a5a, 0x5a6a5a, 0x8a6a3a],
    tradie: { s: "#9bc53d", v: "#ff7518", b: "#1a1a2e" },
    kelpie: { r: "#1c1c1c", d: "#0a0a0a", t: "#2a2a2a", w: "#ffd400" },
    ute: { w: "#1a1a1a", t: "#b388ff", r: "#3a3a3a" },
    car: { w: "#4a3a5a", t: "#b388ff", r: "#3a3a3a" },
    hazard: { frames: PUMPKIN_FRAMES, palette: { o: "#1a1a1a", c: "#ff7518", w: "#ffd400", g: "#3a7d2a" } },
    critters: [
      {
        key: "ghost",
        frames: GHOST_FRAMES,
        palette: { o: "#c9c9e6", w: "#f4f4ff" },
        count: 3,
        alpha: 0.75,
        cross: [40, 70],
        band: [0.15, 0.7],
        bob: 18,
        flap: 500,
      },
      {
        key: "bat",
        frames: BAT_FRAMES,
        palette: { o: "#0a0a0a", e: "#ff3030" },
        count: 6,
        alpha: 1,
        cross: [12, 25],
        band: [0.05, 0.5],
        bob: 10,
        flap: 120,
      },
    ],
  },
};

const pick = (): Theme => {
  const q = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("theme");
  const env = (import.meta as unknown as { env?: { VITE_THEME?: string } }).env;
  const name = q ?? env?.VITE_THEME ?? "default";
  return THEMES[name] ?? THEMES.default!;
};
export const theme = pick();
