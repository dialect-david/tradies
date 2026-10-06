import Phaser from "phaser";
import type { Item } from "../server/model.js";
import { cast, TRADE_COLOUR, type Cast } from "./cast.js";
import { items as fetchItems, onRefresh } from "./client.js";
import { openCard, openBoard, toast } from "./card.js";
import {
  CAN_FRAMES,
  CAN_PALETTE,
  KELPIE_FRAMES,
  KELPIE_PALETTE,
  paint,
  SLAB_FRAMES,
  SLAB_PALETTE,
  slabs,
  stage,
  TRADIE_FRAMES,
  TRADIE_PALETTE,
  type Stage,
} from "./sprites.js";

const GROUND = 0.78;
const T = 18;
const TS = 3;
const PX = 3;
const HS = 2;
const TILE = {
  grass: 1,
  dirt: 121,
  plank: 48,
  crate: 6,
  pole: 69,
  beam: 47,
  roof: 13,
  window: 151,
  door: 130,
  bush: 124,
  tree: 126,
  cloud: [153, 154, 155],
  sign: 86,
};

type Actor = { item: Item; body: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; role: string };

export class Site extends Phaser.Scene {
  private actors = new Map<string, Actor>();
  private board!: Phaser.GameObjects.Container;
  private boardRows: Item[] = [];
  private boardTop = 0;
  private kelpie!: Phaser.GameObjects.Sprite;
  private rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private house!: Phaser.GameObjects.Container;
  private houseStage?: Stage;
  private hud = document.getElementById("hud")!;
  private current: Cast = cast([]);
  private closed = 0;
  private beers!: Phaser.GameObjects.Container;
  private beerCount = -1;

  preload() {
    this.load.spritesheet("tiles", "/kenney/tilemap_packed.png", {
      frameWidth: T,
      frameHeight: T,
    });
    const g = this.make.graphics({}, false);
    g.fillStyle(0x7fb3ff).fillRect(0, 0, 2, 10);
    g.generateTexture("drop", 2, 10);
    this.sheet("kelpie", KELPIE_FRAMES, KELPIE_PALETTE);
    this.sheet("slab", SLAB_FRAMES, SLAB_PALETTE);
    this.sheet("can", CAN_FRAMES, CAN_PALETTE);
    for (const [trade, colour] of Object.entries(TRADE_COLOUR))
      this.sheet(`tradie-${trade}`, TRADIE_FRAMES, {
        ...TRADIE_PALETTE,
        H: "#" + colour.toString(16).padStart(6, "0"),
      });
    this.sheet("tradie-inspector", TRADIE_FRAMES, {
      ...TRADIE_PALETTE,
      H: "#ffffff",
      v: "#2c3e50",
      V: "#2c3e50",
    });
  }

  sheet(key: string, frames: string[][], palette: Record<string, string>) {
    const w = frames[0]![0]!.length;
    const h = frames[0]!.length;
    const tex = this.textures.createCanvas(key, w * frames.length * PX, h * PX)!;
    paint(tex.context, frames, palette, PX);
    frames.forEach((_, i) => tex.add(i, 0, i * w * PX, 0, w * PX, h * PX));
    tex.refresh();
  }

  create() {
    const { width: w, height: h } = this.scale;
    const gy = h * GROUND;
    for (let x = 0; x < w + T * TS; x += T * TS) {
      this.add.image(x, gy, "tiles", TILE.grass).setOrigin(0, 0).setScale(TS);
      for (let y = gy + T * TS; y < h; y += T * TS)
        this.add.image(x, y, "tiles", TILE.dirt).setOrigin(0, 0).setScale(TS);
    }
    for (let i = 0; i < 5; i++) {
      const c = this.add
        .image(Phaser.Math.Between(0, w), Phaser.Math.Between(40, 220), "tiles", TILE.cloud[i % 3]!)
        .setScale(TS * 1.5)
        .setAlpha(0.9);
      this.tweens.add({
        targets: c,
        x: c.x + w + 200,
        duration: Phaser.Math.Between(60000, 120000),
        repeat: -1,
        onRepeat: () => c.setX(-100),
      });
    }
    this.house = this.add.container(w * 0.08, gy);
    this.beers = this.add.container(w * 0.36, gy);
    this.add
      .image(w * 0.08 + 8 * T * HS + 24, gy, "tiles", TILE.sign)
      .setOrigin(0.5, 1)
      .setScale(HS)
      .setInteractive()
      .on("pointerdown", () => openBoard(this.current.ready));
    this.add
      .text(w * 0.08 + 8 * T * HS + 24, gy - 22 * HS, "jobs", { fontSize: "9px", color: "#fff" })
      .setOrigin(0.5, 1);
    this.add
      .image(w * 0.035, gy, "tiles", TILE.tree)
      .setOrigin(0.5, 1)
      .setScale(TS);

    this.add.rectangle(w * 0.58, h * 0.33, 480, 260, 0x111111, 0.82).setStrokeStyle(4, 0xf1c40f);
    this.add
      .text(w * 0.58, h * 0.33 - 150, "ON THE TOOLS", {
        color: "#f1c40f",
        fontSize: "18px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.board = this.add.container(w * 0.58 - 225, h * 0.33 - 120);
    this.time.addEvent({ delay: 2500, loop: true, callback: () => this.drawBoard(this.boardTop + 1) });

    this.add
      .image(w * 0.72, gy, "tiles", TILE.crate)
      .setOrigin(0.5, 1)
      .setScale(TS)
      .setTint(0xcc3333);
    this.add.text(w * 0.72, gy - 8, "esky", { fontSize: "10px", color: "#fff" }).setOrigin(0.5, 1);

    this.rain = this.add.particles(0, 0, "drop", {
      x: { min: 0, max: w },
      y: -10,
      lifespan: 1400,
      speedY: { min: 500, max: 700 },
      quantity: 6,
      frequency: 40,
      emitting: false,
    });

    this.anims.create({
      key: "kelpie-run",
      frames: this.anims.generateFrameNumbers("kelpie", { frames: [0, 1] }),
      frameRate: 8,
      repeat: -1,
    });
    for (const key of [...Object.keys(TRADE_COLOUR).map((t) => `tradie-${t}`), "tradie-inspector"])
      this.anims.create({
        key: `${key}-walk`,
        frames: this.anims.generateFrameNumbers(key, { frames: [0, 1] }),
        frameRate: 4,
        repeat: -1,
      });

    this.kelpie = this.add
      .sprite(w * 0.5, gy, "kelpie", 2)
      .setOrigin(0.5, 1)
      .setInteractive()
      .setDepth(10);
    this.kelpie.on("pointerdown", () => {
      toast("good girl");
      this.tweens.add({ targets: this.kelpie, y: gy - 30, duration: 150, yoyo: true });
    });

    this.hud.innerHTML = `<span id="site"></span><span id="counts"></span><button id="jobs">job board</button><button id="smoko">smoko</button>`;
    this.hud.querySelector("#smoko")!.addEventListener("click", () => this.smoko());
    this.hud.querySelector("#jobs")!.addEventListener("click", () => openBoard(this.current.ready));

    void this.refresh();
    onRefresh(() => void this.refresh());
  }

  async refresh() {
    try {
      const { site, closed, items } = await fetchItems();
      this.closed = closed;
      this.current = cast(items);
      this.hud.querySelector("#site")!.textContent = `🏗 ${site}`;
      this.place(this.current);
    } catch (e) {
      toast(`strewth: ${(e as Error).message}`);
    }
  }

  buildHouse(s: Stage) {
    if (s === this.houseStage) return;
    this.houseStage = s;
    this.house.removeAll(true);
    const tile = (col: number, row: number, frame: number, tint?: number) => {
      const img = this.add
        .image(col * T * HS, -row * T * HS, "tiles", frame)
        .setOrigin(0, 1)
        .setScale(HS);
      if (tint) img.setTint(tint);
      this.house.add(img);
      return img;
    };
    const W = 8;
    const H = 3;
    const at = ["site", "slab", "frame", "roof", "lockup", "fitout", "done"].indexOf(s);
    if (at >= 1) for (let c = 0; c < W; c++) tile(c, 0, TILE.plank);
    if (at >= 2) {
      for (let r = 1; r <= H; r++) for (const c of [0, W - 1, Math.floor(W / 2)]) tile(c, r, TILE.pole);
      for (let c = 0; c < W; c++) tile(c, H + 1, TILE.beam);
    }
    if (at >= 3) for (let c = 0; c < W; c++) tile(c, H + 2, TILE.roof);
    if (at >= 4) {
      for (let r = 1; r <= H; r++) for (let c = 0; c < W; c++) if (c !== 3 || r > 1) tile(c, r, TILE.crate);
      tile(3, 1, TILE.door);
    }
    if (at >= 5) for (const c of [1, W - 2]) tile(c, 2, TILE.window);
    if (at >= 6) for (const c of [-1, W]) tile(c, 1, TILE.bush);
    const label = this.add
      .text((W * T * HS) / 2, -(H + 3) * T * HS - 4, s === "done" ? "lockup party" : s, {
        fontSize: "11px",
        color: "#fff",
      })
      .setOrigin(0.5, 1);
    this.house.add(label);
  }

  place(c: Cast) {
    const { width: w, height: h } = this.scale;
    const gy = h * GROUND;
    const open = c.working.length + c.waiting.length + c.smoko.length + c.ready.length;
    this.stackBeers(this.closed);
    this.buildHouse(stage(this.closed, this.current ? open : 0));
    const seen = new Set<string>();
    const spot = (role: string, n: number) =>
      role === "working"
        ? [w * 0.1 + n * 44, gy]
        : role === "waiting"
          ? [w * 0.52 + (n % 8) * 24, gy - Math.floor(n / 8) * 60]
          : [w * 0.74 + (n % 10) * 26, gy - 16 - Math.floor(n / 10) * 46];

    const put = (item: Item, role: string, n: number) => {
      seen.add(item.id);
      const [x, y] = spot(role, n) as [number, number];
      let a = this.actors.get(item.id);
      if (!a) {
        const key =
          item.kind === "pr"
            ? "tradie-inspector"
            : `tradie-${item.trade in TRADE_COLOUR ? item.trade : "task"}`;
        const body = this.add.sprite(x, -40, key, 0).setOrigin(0.5, 1).setInteractive();
        const label = this.add
          .text(x, y + 2, item.id.replace(/^[a-z]+-/, ""), {
            fontSize: "9px",
            color: "#fff",
            backgroundColor: "#0008",
          })
          .setOrigin(0.5, 0);
        body.on("pointerdown", () => void openCard(item));
        body.on("pointerover", () => label.setText(item.title.slice(0, 40)).setVisible(true).setDepth(20));
        body.on("pointerout", () =>
          label
            .setText(item.id.replace(/^[a-z]+-/, ""))
            .setVisible(role === "working")
            .setDepth(0),
        );
        a = { item, body, label, role };
        this.actors.set(item.id, a);
      }
      a.item = item;
      a.role = role;
      a.label.setVisible(role === "working");
      a.body.setDepth(role === "working" ? 5 : 1);
      if (role === "smoko") a.body.setFrame(2);
      else a.body.setFrame(0);
      this.tweens.add({ targets: a.body, x, y, duration: 600, ease: "Bounce.Out" });
      this.tweens.add({ targets: a.label, x, y: y + 2, duration: 600 });
      if (role === "working") this.wander(a);
      else a.body.anims.stop();
    };
    c.working.forEach((i, n) => put(i, "working", n));
    c.waiting.forEach((i, n) => put(i, "waiting", n));
    c.smoko.forEach((i, n) => put(i, "smoko", n));

    for (const [id, a] of this.actors)
      if (!seen.has(id)) {
        this.tweens.add({
          targets: [a.body, a.label],
          alpha: 0,
          y: "-=40",
          duration: 500,
          onComplete: () => (a.body.destroy(), a.label.destroy()),
        });
        this.actors.delete(id);
      }

    this.boardRows = c.working;
    this.drawBoard(0);

    if (c.rain) this.rain.start();
    else this.rain.stop();
    this.hud.querySelector("#counts")!.textContent =
      `${this.houseStage} · ${c.working.length} on the tools · ${c.ready.length} ready · ${c.waiting.length} waiting on materials · ${c.smoko.length} on smoko · ${c.inspectors.length} inspectors${c.rain ? " · ☔ rain" : ""}`;

    const target = c.worst && this.actors.get(c.worst.id);
    const tx = target ? target.body.x + 26 : w * 0.5;
    this.kelpie.play("kelpie-run");
    this.kelpie.setFlipX(tx < this.kelpie.x);
    this.tweens.add({
      targets: this.kelpie,
      x: tx,
      duration: Math.abs(tx - this.kelpie.x) * 2 + 200,
      ease: "Sine.InOut",
      onComplete: () => (this.kelpie.anims.stop(), this.kelpie.setFrame(target ? 2 : 3)),
    });
    if (c.worst?.priority === 0 || c.rain) toast("woof! " + (c.worst?.id ?? ""));
  }

  stackBeers(closed: number) {
    if (closed === this.beerCount) return;
    const grew = this.beerCount >= 0 && closed > this.beerCount;
    this.beerCount = closed;
    this.beers.removeAll(true);
    const { slabs: n, cans } = slabs(closed);
    const SW = 22 * PX;
    const SH = 9 * PX;
    const perRow = 3;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      this.beers.add(this.add.image(col * SW + (row % 2) * (SW / 2), -row * SH, "slab", 0).setOrigin(0, 1));
    }
    const top = -Math.ceil(n / perRow) * SH;
    for (let i = 0; i < cans; i++) this.beers.add(this.add.image(i * 5 * PX, top, "can", 0).setOrigin(0, 1));
    const label = this.add
      .text((perRow * SW) / 2, top - 8 * PX, `${closed} beers · ${n} slab${n === 1 ? "" : "s"}`, {
        fontSize: "11px",
        color: "#fff",
      })
      .setOrigin(0.5, 1);
    this.beers.add(label);
    if (grew) this.shout();
  }

  shout() {
    const { width: w, height: h } = this.scale;
    const can = this.add
      .image(w * 0.58, h * 0.33, "can", 0)
      .setScale(2)
      .setDepth(20);
    this.tweens.add({
      targets: can,
      x: this.beers.x + 40,
      y: this.beers.y - 60,
      duration: 900,
      ease: "Quad.In",
      onComplete: () => can.destroy(),
    });
    toast("one for the esky");
  }

  drawBoard(top: number) {
    const rows = this.boardRows;
    const fit = 10;
    this.boardTop = rows.length > fit ? top % rows.length : 0;
    this.board.removeAll(true);
    if (!rows.length) {
      this.board.add(this.add.text(0, 0, "nobody on the tools. claim something.", { color: "#888" }));
      return;
    }
    for (let n = 0; n < Math.min(fit, rows.length); n++) {
      const i = rows[(this.boardTop + n) % rows.length]!;
      const t = this.add
        .text(0, n * 22, `◐ ${i.id}  ${i.title.slice(0, 48)}`, { fontSize: "13px", color: "#eee" })
        .setInteractive();
      t.on("pointerdown", () => void openCard(i));
      this.board.add(t);
    }
  }

  wander(a: Actor) {
    const dx = Phaser.Math.Between(-40, 40);
    a.body.setFlipX(dx < 0);
    a.body.play(`${a.body.texture.key}-walk`, true);
    this.tweens.add({
      targets: [a.body, a.label],
      x: `+=${dx}`,
      duration: Math.abs(dx) * 40 + 200,
      delay: Phaser.Math.Between(0, 2500),
      onStart: () => a.body.play(`${a.body.texture.key}-walk`, true),
      onComplete: () => {
        a.body.anims.stop();
        a.body.setFrame(0);
        if (a.role === "working" && this.actors.get(a.item.id) === a) this.wander(a);
      },
    });
    a.body.anims.stop();
    a.body.setFrame(0);
  }

  smoko() {
    toast("smoko. ten minutes.");
    const { width: w, height: h } = this.scale;
    for (const a of this.actors.values()) {
      this.tweens.killTweensOf([a.body, a.label]);
      a.role = "smoko";
      a.body.anims.stop();
      a.body.setFrame(2);
      this.tweens.add({
        targets: a.body,
        x: w * 0.78 + Math.random() * 160,
        y: h * GROUND - 20,
        duration: 1200,
      });
    }
    this.kelpie.play("kelpie-run");
    this.tweens.add({
      targets: this.kelpie,
      x: { from: w * 0.1, to: w * 0.9 },
      duration: 1500,
      yoyo: true,
      repeat: 5,
      onYoyo: () => this.kelpie.setFlipX(true),
      onRepeat: () => this.kelpie.setFlipX(false),
    });
    this.time.delayedCall(10 * 60 * 1000, () => this.place(this.current));
  }
}
