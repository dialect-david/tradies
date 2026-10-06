import Phaser from "phaser";
import type { Item } from "../server/model.js";
import { cast, TRADE_COLOUR, type Cast } from "./cast.js";
import { items as fetchItems, knockoff, onRefresh } from "./client.js";
import { openCard, openBoard, openKnockoff, toast } from "./card.js";
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
  UTE_FRAMES,
  UTE_PALETTE,
  EMPTY_PALETTE,
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
  fence: 105,
  sign: 86,
};

type Actor = {
  item: Item;
  body: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  role: string;
  gen: number;
  puff?: Phaser.GameObjects.Particles.ParticleEmitter;
};

export class Site extends Phaser.Scene {
  private actors = new Map<string, Actor>();
  private board!: Phaser.GameObjects.Container;
  private boardRows: Item[] = [];
  private boardTop = 0;
  private boardChars = 76;
  private kelpie!: Phaser.GameObjects.Sprite;
  private rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private house!: Phaser.GameObjects.Container;
  private houseStage?: Stage;
  private hud = document.getElementById("hud")!;
  private current: Cast = cast([]);
  private closed = 0;
  private beers!: Phaser.GameObjects.Container;
  private beerCount = -1;
  private pallets!: Phaser.GameObjects.Container;
  private empties!: Phaser.GameObjects.Container;
  private ute!: Phaser.GameObjects.Container;
  private cars = new Map<string, Phaser.GameObjects.Container>();
  private roadY = 0;
  private door?: Phaser.GameObjects.Image;
  private doorUsers = 0;
  private dusk!: Phaser.GameObjects.Rectangle;
  private sun!: Phaser.GameObjects.Arc;

  preload() {
    this.load.spritesheet("tiles", "/kenney/tilemap_packed.png", {
      frameWidth: T,
      frameHeight: T,
    });
    const g = this.make.graphics({}, false);
    g.fillStyle(0x7fb3ff).fillRect(0, 0, 2, 10);
    g.generateTexture("drop", 2, 10);
    g.clear().fillStyle(0xd9c7a0).fillCircle(3, 3, 3);
    g.generateTexture("dust", 6, 6);
    this.sheet("kelpie", KELPIE_FRAMES, KELPIE_PALETTE);
    this.sheet("slab", SLAB_FRAMES, SLAB_PALETTE);
    this.sheet("can", CAN_FRAMES, CAN_PALETTE);
    this.sheet("empty", CAN_FRAMES, EMPTY_PALETTE);
    this.sheet("ute", UTE_FRAMES, UTE_PALETTE);
    this.sheet("car", UTE_FRAMES, { ...UTE_PALETTE, w: "#e8eef5", t: "#2c3e50" });
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
    const boardW = Math.min(1100, w * 0.62);
    for (let x = 0; x < w + T * TS; x += T * TS) {
      this.add.image(x, gy, "tiles", TILE.grass).setOrigin(0, 0).setScale(TS);
      for (let y = gy + T * TS; y < h; y += T * TS)
        this.add.image(x, y, "tiles", TILE.dirt).setOrigin(0, 0).setScale(TS);
    }
    this.roadY = gy + T * TS * 2 + 8;
    this.add.rectangle(w / 2, this.roadY - 22, w, 44, 0x4a4a4a).setDepth(1);
    for (let x = 10; x < w; x += 60) this.add.rectangle(x, this.roadY - 22, 30, 3, 0xdddddd).setDepth(1);
    for (let i = 0; i < 5; i++) {
      const c = this.add.container(Phaser.Math.Between(0, w), Phaser.Math.Between(40, 220), [
        this.add.image(0, 0, "tiles", TILE.cloud[0]!).setOrigin(0, 0).setScale(TS).setFlipY(true),
        this.add
          .image(T * TS, 0, "tiles", TILE.cloud[1]!)
          .setOrigin(0, 0)
          .setScale(TS)
          .setFlipY(true),
        this.add
          .image(2 * T * TS, 0, "tiles", TILE.cloud[2]!)
          .setOrigin(0, 0)
          .setScale(TS)
          .setFlipY(true),
      ]);
      c.setAlpha(0.9);
      this.tweens.add({
        targets: c,
        x: c.x + w + 200,
        duration: Phaser.Math.Between(60000, 120000),
        repeat: -1,
        onRepeat: () => c.setX(-200),
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

    this.add
      .rectangle(w * 0.5, 150, boardW, 220, 0x111111, 0.82)
      .setStrokeStyle(4, 0xf1c40f)
      .setDepth(3);
    this.add
      .text(w * 0.5, 28, "ON THE TOOLS", {
        color: "#f1c40f",
        fontSize: "18px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.board = this.add.container(w * 0.5 - boardW / 2 + 16, 52).setDepth(3);
    this.boardChars = Math.floor((boardW - 32) / 7.9);
    this.time.addEvent({ delay: 2500, loop: true, callback: () => this.drawBoard(this.boardTop + 1) });

    this.pallets = this.add.container(w * 0.53, gy);
    this.add
      .image(w * 0.53 - 30, gy, "tiles", TILE.fence)
      .setOrigin(0.5, 1)
      .setScale(TS);
    this.empties = this.add.container(w * 0.74, gy);
    this.ute = this.add.container(w * 0.88, gy);
    this.sun = this.add.circle(w * 0.15, 90, 34, 0xffe066).setDepth(-1);
    this.dusk = this.add.rectangle(w / 2, h / 2, w, h, 0x2a1a3e, 0).setDepth(9);

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
      for (const [name, frames, rate] of [
        ["walk", [0, 1], 4],
        ["hammer", [4, 5], 6],
      ] as const)
        this.anims.create({
          key: `${key}-${name}`,
          frames: this.anims.generateFrameNumbers(key, { frames: [...frames] }),
          frameRate: rate,
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

    this.hud.innerHTML = `<span id="site"></span><span id="counts"></span><button id="jobs">job board</button><button id="smoko">smoko</button><button id="knockoff">knock-off</button>`;
    this.hud.querySelector("#smoko")!.addEventListener("click", () => this.smoko());
    this.hud.querySelector("#jobs")!.addEventListener("click", () => openBoard(this.current.ready));
    this.hud.querySelector("#knockoff")!.addEventListener("click", () => void this.knockoff());

    (window as unknown as { site: Site }).site = this;
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
      this.house.add(this.add.rectangle(3 * T * HS, -T * HS, T * HS, T * HS, 0x1a1008).setOrigin(0, 1));
      this.door = tile(3, 1, TILE.door);
      this.doorUsers = 0;
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
          ? [w * 0.53 + 150 + n * 30, gy]
          : [w * 0.74 + 70 + n * 34, gy];

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
        a = { item, body, label, role, gen: 0 };
        this.actors.set(item.id, a);
      }
      a.item = item;
      a.role = role;
      a.label.setVisible(role === "working");
      a.body.setDepth(role === "working" ? 5 : 1);
      a.body.setFrame(role === "smoko" ? 2 : role === "waiting" ? 3 : 0);
      this.tweens.add({ targets: a.body, x, y, duration: 600, ease: "Bounce.Out" });
      this.tweens.add({ targets: a.label, x, y: y + 2, duration: 600 });
      this.settle(a);
      if (role === "working") this.wander(a);
      else a.body.anims.stop();
    };
    c.working.forEach((i, n) => put(i, "working", n));
    c.waiting.slice(0, 3).forEach((i, n) => put(i, "waiting", n));
    c.smoko.slice(0, 3).forEach((i, n) => put(i, "smoko", n));
    this.pile(
      this.pallets,
      "tiles",
      TILE.crate,
      c.waiting,
      4,
      T * HS,
      "waiting on materials",
      TS === 3 ? HS : HS,
    );
    this.pile(this.empties, "empty", 0, c.smoko, 8, 9, "on smoko", 0.6, { x: -8, y: -18 * PX });
    this.esky();
    this.drive(c.gone);
    this.inspect(c.inspectors);

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
      `${this.houseStage} · ${c.working.length} on the tools · ${c.ready.length} ready · ${c.waiting.length} waiting on materials · ${c.smoko.length} on smoko · ${c.gone.length} gone home · ${c.inspectors.length} inspectors${c.rain ? " · ☔ rain" : ""}`;

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

  pile(
    box: Phaser.GameObjects.Container,
    key: string,
    frame: number,
    items: Item[],
    perRow: number,
    step: number,
    title: string,
    scale: number,
    offset = { x: 0, y: 0 },
  ) {
    box.removeAll(true);
    items.forEach((_, i) => {
      const row = Math.floor(i / perRow);
      const img = this.add
        .image(offset.x + (i % perRow) * step, offset.y - row * step, key, frame)
        .setOrigin(0, 1)
        .setScale(scale)
        .setInteractive();
      img.on("pointerdown", () => openBoard(items, title, false));
      box.add(img);
    });
    if (items.length)
      box.add(
        this.add
          .text(
            offset.x + (perRow * step) / 2,
            offset.y - Math.ceil(items.length / perRow) * step - 4,
            `${items.length} ${title}`,
            { fontSize: "10px", color: "#fff" },
          )
          .setOrigin(0.5, 1),
      );
  }

  esky() {
    if (this.empties.getByName("esky")) return;
    const e = this.add
      .image(0, 0, "tiles", TILE.crate)
      .setOrigin(0, 1)
      .setScale(TS)
      .setTint(0xcc3333)
      .setName("esky")
      .setInteractive();
    e.on("pointerdown", () => openBoard(this.current.smoko, "on smoko", false));
    this.empties.addAt(e, 0);
  }

  inspect(prs: Item[]) {
    const { width: w } = this.scale;
    const seen = new Set<string>();
    prs.forEach((pr, n) => {
      seen.add(pr.id);
      const x = w * 0.12 + n * 150;
      let car = this.cars.get(pr.id);
      if (!car) {
        car = this.add.container(-120, this.roadY).setDepth(2);
        const body = this.add.image(0, 0, "car", 0).setOrigin(0.5, 1).setInteractive();
        body.on("pointerdown", () => void openCard(pr));
        const who = this.add.sprite(-60, 0, "tradie-inspector", 0).setOrigin(0.5, 1).setInteractive();
        who.on("pointerdown", () => void openCard(pr));
        const label = this.add
          .text(0, 4, "", { fontSize: "9px", color: "#fff", backgroundColor: "#0008" })
          .setOrigin(0.5, 0);
        car.add([body, who, label]);
        this.cars.set(pr.id, car);
        this.tweens.add({ targets: car, x, duration: 2500, ease: "Quad.Out" });
      } else this.tweens.add({ targets: car, x, duration: 800 });
      const ci = pr.labels.find((l) => l.startsWith("ci:"))?.slice(3);
      const mood =
        pr.status === "draft" ? "L plates" : pr.status === "approved" ? "signed off ✓" : "inspecting";
      (car.getAt(2) as Phaser.GameObjects.Text).setText(
        `${pr.id} · ${mood}${ci === "fail" ? " · ☔ failed" : ci === "pending" ? " · checking" : ""}`,
      );
      (car.getAt(0) as Phaser.GameObjects.Image).setTint(
        ci === "fail" ? 0xff8080 : pr.status === "approved" ? 0xa0ffa0 : 0xffffff,
      );
    });
    for (const [id, car] of this.cars)
      if (!seen.has(id)) {
        this.cars.delete(id);
        this.tweens.add({
          targets: car,
          x: w + 150,
          duration: 2000,
          ease: "Quad.In",
          onComplete: () => car.destroy(),
        });
      }
  }

  drive(gone: Item[]) {
    this.ute.removeAll(true);
    const u = this.add.image(0, 0, "ute", 0).setOrigin(0.5, 1).setInteractive();
    u.on("pointerdown", () => openBoard(gone, "gone home", false));
    this.ute.add(u);
    if (!gone.length) return;
    this.ute.add(
      this.add
        .text(0, -12 * PX - 4, `${gone.length} gone home`, { fontSize: "10px", color: "#fff" })
        .setOrigin(0.5, 1),
    );
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
      .image(w * 0.5, 150, "can", 0)
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
    const fit = 9;
    this.boardTop = rows.length > fit ? top % rows.length : 0;
    this.board.removeAll(true);
    if (!rows.length) {
      this.board.add(this.add.text(0, 0, "nobody on the tools. claim something.", { color: "#888" }));
      return;
    }
    for (let n = 0; n < Math.min(fit, rows.length); n++) {
      const i = rows[(this.boardTop + n) % rows.length]!;
      const t = this.add
        .text(0, n * 22, `◐ ${i.id}  ${i.title}`.slice(0, this.boardChars), {
          fontSize: "13px",
          color: "#eee",
        })
        .setInteractive();
      t.on("pointerdown", () => void openCard(i));
      this.board.add(t);
    }
  }

  wander(a: Actor) {
    const gen = a.gen;
    const alive = () => a.gen === gen && a.role === "working" && this.actors.get(a.item.id) === a;
    const houseL = this.house.x + 10;
    const houseR = this.house.x + 8 * T * HS - 10;
    const door = this.house.x + 3.5 * T * HS;
    const insideOk = ["lockup", "fitout", "done"].includes(this.houseStage ?? "");
    const roll = Math.random();
    const to = roll < 0.2 && insideOk ? door : Phaser.Math.Between(houseL, houseR);
    const walk = (x: number, then: () => void) => {
      a.body.setFlipX(x < a.body.x);
      a.body.play(`${a.body.texture.key}-walk`, true);
      this.tweens.add({
        targets: [a.body, a.label],
        x,
        duration: Math.abs(x - a.body.x) * 12 + 200,
        onComplete: () => {
          a.body.anims.stop();
          a.body.setFrame(0);
          if (alive()) then();
        },
      });
    };
    const hammer = (ms: number, then: () => void) => {
      a.body.play(`${a.body.texture.key}-hammer`, true);
      const puff = (a.puff = this.add.particles(a.body.x + (a.body.flipX ? -14 : 14), a.body.y - 30, "dust", {
        speed: { min: 20, max: 60 },
        angle: { min: 200, max: 340 },
        lifespan: 500,
        scale: { start: 1, end: 0 },
        frequency: 160,
        quantity: 2,
      }));
      this.time.delayedCall(ms, () => {
        this.dustOff(a, puff);
        a.body.anims.stop();
        a.body.setFrame(0);
        if (alive()) then();
      });
    };
    const inside = (then: () => void) => {
      this.swingDoor(true, () =>
        this.tweens.add({
          targets: [a.body, a.label],
          alpha: 0,
          duration: 300,
          onComplete: () => this.swingDoor(false),
        }),
      );
      this.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
        this.swingDoor(true, () =>
          this.tweens.add({
            targets: [a.body, a.label],
            alpha: 1,
            duration: 300,
            onComplete: () => this.swingDoor(false),
          }),
        );
        if (alive()) then();
      });
    };
    this.time.delayedCall(Phaser.Math.Between(300, 2000), () => {
      if (!alive()) return;
      walk(to, () =>
        to === door
          ? inside(() => this.wander(a))
          : hammer(Phaser.Math.Between(1500, 4000), () => this.wander(a)),
      );
    });
  }

  settle(a: Actor) {
    a.gen++;
    if (a.puff) this.dustOff(a, a.puff);
    a.body.anims.stop();
    a.body.setAlpha(1);
    a.label.setAlpha(1);
  }

  dustOff(a: Actor, puff: Phaser.GameObjects.Particles.ParticleEmitter) {
    if (a.puff === puff) a.puff = undefined;
    puff.stop();
    this.time.delayedCall(600, () => puff.destroy());
  }

  swingDoor(open: boolean, then?: () => void) {
    const d = this.door;
    if (!d) return then?.();
    this.doorUsers += open ? 1 : -1;
    if (open ? this.doorUsers > 1 : this.doorUsers > 0) return then?.();
    this.tweens.add({
      targets: d,
      scaleX: open ? HS * 0.25 : HS,
      duration: 220,
      ease: "Quad.Out",
      onComplete: then,
    });
  }

  async knockoff() {
    const { height: h } = this.scale;
    this.tweens.add({ targets: this.dusk, fillAlpha: 0.5, duration: 2500 });
    this.tweens.add({ targets: this.sun, y: h * GROUND + 40, duration: 3000, ease: "Sine.In" });
    for (const a of this.actors.values()) {
      this.tweens.killTweensOf([a.body, a.label]);
      a.body.play(`${a.body.texture.key}-walk`, true);
      a.body.setFlipX(false);
      this.tweens.add({
        targets: [a.body, a.label],
        x: this.ute.x - 20 + Math.random() * 60,
        duration: 2500,
        onComplete: () => (a.body.anims.stop(), a.body.setFrame(0)),
      });
    }
    this.kelpie.play("kelpie-run");
    this.kelpie.setFlipX(false);
    this.tweens.add({
      targets: this.kelpie,
      x: this.ute.x + 70,
      duration: 2000,
      onComplete: () => (this.kelpie.anims.stop(), this.kelpie.setFrame(3)),
    });
    try {
      const { today } = await knockoff();
      openKnockoff(today, this.current, () => this.day());
    } catch (e) {
      toast(`strewth: ${(e as Error).message}`);
      this.day();
    }
  }

  day() {
    this.tweens.add({ targets: this.dusk, fillAlpha: 0, duration: 1500 });
    this.tweens.add({ targets: this.sun, y: 90, duration: 1500 });
    this.place(this.current);
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
