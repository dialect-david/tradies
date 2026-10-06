import Phaser from "phaser";
import type { Item } from "../server/model.js";
import { cast, TRADE_COLOUR, whoIsNeeded, type Cast } from "./cast.js";
import { items as fetchItems, knockoff, onRefresh } from "./client.js";
import { openCard, openBoard, openKnockoff, toast } from "./card.js";
import { HOUSE_W, layoutStreet, SHED, shortTitle, TILE_PX, type House } from "./street.js";
import {
  CAN_FRAMES,
  CAN_PALETTE,
  KELPIE_FRAMES,
  KELPIE_PALETTE,
  paint,
  SLAB_FRAMES,
  SLAB_PALETTE,
  slabs,
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
const TT = 16;
const HS = TILE_PX / TT;
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
const TOWN = {
  post: 47,
  beam: 100,
  roof: { red: [52, 53, 54, 67], grey: [48, 49, 50, 63] },
  wall: { wood: { plain: 75, window: 73, opening: 74 }, stone: { plain: 79, window: 77, opening: 78 } },
  door: 85,
  doorLit: 84,
  fenceL: 44,
  fenceR: 46,
};
const STAGES: Stage[] = ["site", "slab", "frame", "roof", "lockup", "fitout", "done"];

type Actor = {
  item: Item;
  body: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  role: string;
  home: string;
  gen: number;
  puff?: Phaser.GameObjects.Particles.ParticleEmitter;
};

type Lot = {
  box: Phaser.GameObjects.Container;
  stage?: Stage;
  door?: Phaser.GameObjects.Image;
  doorUsers: number;
  house: House;
};

export class Site extends Phaser.Scene {
  private actors = new Map<string, Actor>();
  private lots = new Map<string, Lot>();
  private board!: Phaser.GameObjects.Container;
  private boardRows: Item[] = [];
  private boardTop = 0;
  private boardChars = 76;
  private kelpie!: Phaser.GameObjects.Sprite;
  private rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hud = document.getElementById("hud")!;
  private current: Cast = cast([]);
  private closed = 0;
  private beers!: Phaser.GameObjects.Container;
  private beerCount = -1;
  private pallets!: Phaser.GameObjects.Container;
  private gate!: Phaser.GameObjects.Image;
  private signoff!: Phaser.GameObjects.Container;
  private plans!: Phaser.GameObjects.Container;
  private empties!: Phaser.GameObjects.Container;
  private ute!: Phaser.GameObjects.Container;
  private sign!: Phaser.GameObjects.Container;
  private cars = new Map<string, Phaser.GameObjects.Container>();
  private roadY = 0;
  private grass!: Phaser.GameObjects.TileSprite;
  private dirt!: Phaser.GameObjects.TileSprite;
  private road!: Phaser.GameObjects.Rectangle;
  private lines!: Phaser.GameObjects.TileSprite;
  private worldW = 0;
  private dusk!: Phaser.GameObjects.Rectangle;
  private sun!: Phaser.GameObjects.Arc;

  preload() {
    this.load.spritesheet("tiles", "/kenney/tilemap_packed.png", { frameWidth: T, frameHeight: T });
    this.load.spritesheet("town", "/kenney/tiny-town.png", { frameWidth: TT, frameHeight: TT });
    const g = this.make.graphics({}, false);
    g.fillStyle(0x7fb3ff).fillRect(0, 0, 2, 10);
    g.generateTexture("drop", 2, 10);
    g.clear().fillStyle(0xd9c7a0).fillCircle(3, 3, 3);
    g.generateTexture("dust", 6, 6);
    g.clear().fillStyle(0xdddddd).fillRect(0, 0, 30, 3);
    g.generateTexture("line", 60, 3);
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
    this.worldW = w;

    this.grass = this.add
      .tileSprite(0, gy, w, T * TS, "tiles", TILE.grass)
      .setOrigin(0, 0)
      .setTileScale(TS);
    this.dirt = this.add
      .tileSprite(0, gy + T * TS, w, h - gy - T * TS, "tiles", TILE.dirt)
      .setOrigin(0, 0)
      .setTileScale(TS);
    this.roadY = gy + T * TS * 2 + 8;
    this.road = this.add
      .rectangle(0, this.roadY - 22, w, 44, 0x4a4a4a)
      .setOrigin(0, 0.5)
      .setDepth(1);
    this.lines = this.add
      .tileSprite(0, this.roadY - 22, w, 3, "line")
      .setOrigin(0, 0.5)
      .setDepth(1);

    for (let i = 0; i < 5; i++) {
      const c = this.add
        .container(Phaser.Math.Between(0, w), Phaser.Math.Between(40, 220), [
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
        ])
        .setAlpha(0.9)
        .setScrollFactor(0.3);
      this.tweens.add({
        targets: c,
        x: c.x + w + 200,
        duration: Phaser.Math.Between(60000, 120000),
        repeat: -1,
        onRepeat: () => c.setX(-200),
      });
    }
    this.add.image(24, gy, "tiles", TILE.tree).setOrigin(0.5, 1).setScale(TS);

    this.add
      .rectangle(w * 0.5, 150, boardW, 220, 0x111111, 0.82)
      .setStrokeStyle(4, 0xf1c40f)
      .setDepth(3)
      .setScrollFactor(0);
    this.add
      .text(w * 0.5, 28, "ON THE TOOLS", { color: "#f1c40f", fontSize: "18px", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(3)
      .setScrollFactor(0);
    this.board = this.add
      .container(w * 0.5 - boardW / 2 + 16, 52)
      .setDepth(3)
      .setScrollFactor(0);
    this.boardChars = Math.floor((boardW - 32) / 7.9);
    this.time.addEvent({ delay: 2500, loop: true, callback: () => this.drawBoard(this.boardTop + 1) });

    this.sign = this.add.container(0, gy, [
      this.add
        .image(0, 0, "tiles", TILE.sign)
        .setOrigin(0.5, 1)
        .setScale(HS)
        .setInteractive()
        .on("pointerdown", () => openBoard(this.current.ready)),
      this.add.text(0, -22 * HS, "jobs", { fontSize: "9px", color: "#fff" }).setOrigin(0.5, 1),
    ]);
    this.beers = this.add.container(0, gy);
    this.gate = this.add.image(0, gy, "tiles", TILE.fence).setOrigin(0.5, 1).setScale(TS);
    this.signoff = this.add.container(0, gy);
    this.plans = this.add.container(0, gy);
    this.pallets = this.add.container(0, gy);
    this.empties = this.add.container(0, gy);
    this.ute = this.add.container(0, gy);
    this.sun = this.add
      .circle(w * 0.15, 90, 34, 0xffe066)
      .setDepth(-1)
      .setScrollFactor(0);
    this.dusk = this.add
      .rectangle(w / 2, h / 2, w, h, 0x2a1a3e, 0)
      .setDepth(9)
      .setScrollFactor(0);

    this.rain = this.add.particles(0, 0, "drop", {
      x: { min: 0, max: w },
      y: -10,
      lifespan: 1400,
      speedY: { min: 500, max: 700 },
      quantity: 6,
      frequency: 40,
      emitting: false,
    });
    this.rain.setScrollFactor(0);

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

    const cam = this.cameras.main;
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown && !p.wasTouch) cam.scrollX -= p.x - p.prevPosition.x;
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, dx: number, dy: number) => {
      cam.scrollX += Math.abs(dx) > Math.abs(dy) ? dx : dy;
    });
    this.input.keyboard?.on("keydown-LEFT", () => (cam.scrollX -= 200));
    this.input.keyboard?.on("keydown-RIGHT", () => (cam.scrollX += 200));

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
      const { site, closed, epics, items } = await fetchItems();
      this.closed = closed;
      this.current = cast(items);
      this.hud.querySelector("#site")!.textContent = `🏗 ${site}`;
      this.street(layoutStreet(epics, items));
      this.place(this.current);
    } catch (e) {
      toast(`strewth: ${(e as Error).message}`);
    }
  }

  street({ houses, shed, width }: ReturnType<typeof layoutStreet>) {
    const { width: w, height: h } = this.scale;
    const gy = h * GROUND;
    const yard = width + 40;
    this.gate.setX(yard);
    this.signoff.setX(yard + 30);
    this.empties.setX(yard + 200);
    this.sign.setX(yard + 460);
    this.pallets.setX(yard + 520);
    this.plans.setX(yard + 780);
    this.beers.setX(yard + 840);
    this.ute.setX(yard + 1140);
    this.worldW = Math.max(w, yard + 1240);
    this.grass.setSize(this.worldW, this.grass.height);
    this.dirt.setSize(this.worldW, this.dirt.height);
    this.road.setSize(this.worldW, 44);
    this.lines.setSize(this.worldW, 3);
    this.cameras.main.setBounds(0, 0, this.worldW, h);
    this.rain.updateConfig({ x: { min: 0, max: w } });

    const seen = new Set<string>();
    for (const house of [...houses, shed]) {
      seen.add(house.id);
      let lot = this.lots.get(house.id);
      if (!lot) {
        lot = { box: this.add.container(house.x, gy), doorUsers: 0, house };
        this.lots.set(house.id, lot);
      }
      lot.house = house;
      lot.box.setX(house.x);
      this.buildHouse(lot);
    }
    for (const [id, lot] of this.lots)
      if (!seen.has(id)) {
        lot.box.destroy();
        this.lots.delete(id);
      }
  }

  buildHouse(lot: Lot) {
    const { house } = lot;
    const label =
      house.id === SHED
        ? `the shed · ${house.items.length}`
        : `${shortTitle(house.title)}\n${house.closed}/${house.total}`;
    if (house.stage === lot.stage) {
      (lot.box.getByName("label") as Phaser.GameObjects.Text | null)?.setText(label);
      return;
    }
    lot.stage = house.stage;
    lot.box.removeAll(true);
    lot.door = undefined;
    lot.doorUsers = 0;
    const shed = house.id === SHED;
    const W = shed ? 2 : HOUSE_W;
    const H = shed ? 1 : 2;
    const seed = [...house.id].reduce((n, ch) => n + ch.charCodeAt(0), 0);
    const roof = shed || seed % 2 ? TOWN.roof.grey : TOWN.roof.red;
    const wall = shed || seed % 3 === 0 ? TOWN.wall.wood : TOWN.wall.stone;
    const SLAB = 10;
    const tile = (col: number, row: number, frame: number, sheet = "town") => {
      const img = this.add
        .image(col * TILE_PX, -(row - 1) * TILE_PX - SLAB, sheet, frame)
        .setOrigin(0, 1)
        .setScale(HS)
        .setInteractive();
      img.on("pointerdown", () => openBoard(house.items, shed ? "the shed" : house.title.slice(0, 60), true));
      lot.box.add(img);
      return img;
    };
    const at = STAGES.indexOf(house.stage);
    const mid = Math.floor(W / 2);
    if (at >= 1) {
      const slab = this.add
        .rectangle(-6, 0, W * TILE_PX + 12, 10, 0xbdbdbd)
        .setOrigin(0, 1)
        .setStrokeStyle(2, 0x6e6e6e)
        .setInteractive();
      slab.on("pointerdown", () =>
        openBoard(house.items, shed ? "the shed" : house.title.slice(0, 60), true),
      );
      lot.box.add(slab);
    }
    if (at >= 2 && at < 4) {
      for (let r = 1; r <= H; r++) for (const c of [0, W - 1]) tile(c, r, TOWN.post);
      for (let c = 0; c < W; c++) tile(c, H + 1, TOWN.beam);
    }
    if (at >= 4) {
      for (let r = 1; r <= H; r++)
        for (let c = 0; c < W; c++) tile(c, r, c === mid && r === 1 ? wall.opening : wall.plain);
      lot.door = tile(mid, 1, at >= 5 ? TOWN.doorLit : TOWN.door);
    }
    if (at >= 3) {
      for (let c = 0; c < W; c++) tile(c, H + 1, roof[c === 0 ? 0 : c === W - 1 ? 2 : 1]!);
      if (W > 2) tile(mid, H + 2, roof[3]!);
    }
    if (at >= 5 && H > 1) for (const c of [0, W - 1]) tile(c, 2, wall.window);
    if (at >= 6) {
      tile(-1, 1, TOWN.fenceL);
      tile(W, 1, TOWN.fenceR);
    }
    lot.box.add(
      this.add
        .text((W * TILE_PX) / 2, -(H + 2) * TILE_PX - 16, label, {
          fontSize: "10px",
          color: "#fff",
          backgroundColor: "#0006",
          align: "center",
          wordWrap: { width: W * TILE_PX + 36 },
        })
        .setOrigin(0.5, 1)
        .setName("label"),
    );
  }

  lotOf(item: Item): Lot {
    for (const lot of this.lots.values()) if (lot.house.items.some((i) => i.id === item.id)) return lot;
    return this.lots.get(SHED)!;
  }

  place(c: Cast) {
    const { width: w, height: h } = this.scale;
    const gy = h * GROUND;
    this.stackBeers(this.closed);
    const seen = new Set<string>();
    const spot = (item: Item, role: string, n: number): [number, number] =>
      role === "working"
        ? [this.lotOf(item).box.x + 20 + (n % 3) * 36, gy]
        : role === "signoff"
          ? [this.signoff.x + 20 + n * 34, gy]
          : role === "waiting"
            ? [this.pallets.x + 150 + n * 30, gy]
            : [this.empties.x + 70 + n * 34, gy];

    const put = (item: Item, role: string, n: number) => {
      seen.add(item.id);
      const [x, y] = spot(item, role, n);
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
        a = { item, body, label, role, home: SHED, gen: 0 };
        this.actors.set(item.id, a);
      }
      a.item = item;
      a.role = role;
      a.home = this.lotOf(item).house.id;
      a.label.setVisible(role === "working");
      a.body.setDepth(role === "working" ? 5 : 1);
      const napping = role === "working" && c.asleep.includes(item);
      a.body.setFrame(
        napping ? 6 : role === "smoko" ? 2 : role === "waiting" ? 3 : role === "signoff" ? 7 : 0,
      );
      this.tweens.add({ targets: a.body, x, y, duration: 600, ease: "Bounce.Out" });
      this.tweens.add({ targets: a.label, x, y: y + 2, duration: 600 });
      this.settle(a);
      if (napping) this.snooze(a);
      else if (role === "working") this.wander(a);
      else a.body.anims.stop();
    };
    c.working.forEach((i, n) => put(i, "working", n));
    c.needsYou.slice(0, 3).forEach((i, n) => put(i, "signoff", n));
    c.waiting.slice(0, 3).forEach((i, n) => put(i, "waiting", n));
    c.smoko.slice(0, 3).forEach((i, n) => put(i, "smoko", n));
    this.pile(this.pallets, "tiles", TILE.crate, c.waiting, 4, T * TS, "waiting on materials", TS);
    this.pile(this.empties, "empty", 0, c.smoko, 8, 9, "on smoko", 0.6, { x: -8, y: -18 * PX });
    this.esky();
    this.signOff(c.needsYou);
    this.shelve(c.deferred);
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
    this.hud.querySelector("#counts")!.textContent = [
      `${c.working.length} on the tools${c.asleep.length ? ` (${c.asleep.length} asleep)` : ""}`,
      `${c.ready.length} ready`,
      c.needsYou.length ? `${c.needsYou.length} on you` : "",
      `${c.waiting.length} materials`,
      `${c.smoko.length} smoko`,
      c.deferred.length ? `${c.deferred.length} plans` : "",
      c.gone.length ? `${c.gone.length} gone home` : "",
      c.inspectors.length ? `${c.inspectors.length} inspectors` : "",
      c.rain ? "☔ rain" : "",
    ]
      .filter(Boolean)
      .join(" · ");

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
    for (const child of [...box.list]) if (child.name !== "esky") child.destroy();
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
            {
              fontSize: "10px",
              color: "#fff",
            },
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
    const seen = new Set<string>();
    prs.forEach((pr, n) => {
      seen.add(pr.id);
      const x = 160 + n * 150;
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
          x: this.worldW + 150,
          duration: 2000,
          ease: "Quad.In",
          onComplete: () => car.destroy(),
        });
      }
  }

  signOff(items: Item[]) {
    this.signoff.removeAll(true);
    if (!items.length) return;
    const who = whoIsNeeded(items[0]!);
    const t = this.add
      .text(50, -70, `${items.length} waiting on ${who}`, {
        fontSize: "10px",
        color: "#ffd166",
        backgroundColor: "#0008",
      })
      .setOrigin(0.5, 1)
      .setInteractive();
    t.on("pointerdown", () => openBoard(items, `waiting on ${who}`, false));
    this.signoff.add(t);
  }

  shelve(items: Item[]) {
    this.plans.removeAll(true);
    if (!items.length) return;
    items.slice(0, 12).forEach((_, i) => {
      const roll = this.add
        .rectangle(0, -i * 7, 40, 6, 0xf1e3c6)
        .setOrigin(0, 1)
        .setStrokeStyle(1, 0x8b5a2b)
        .setInteractive();
      roll.on("pointerdown", () => openBoard(items, "on the plans", false));
      this.plans.add(roll);
    });
    const t = this.add
      .text(20, -Math.min(items.length, 12) * 7 - 6, `${items.length} on the plans`, {
        fontSize: "9px",
        color: "#fff",
        backgroundColor: "#0006",
      })
      .setOrigin(0.5, 1)
      .setInteractive();
    t.on("pointerdown", () => openBoard(items, "on the plans", false));
    this.plans.add(t);
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
    this.beers.add(
      this.add
        .text((perRow * SW) / 2, top - 8 * PX, `${closed} beers · ${n} slab${n === 1 ? "" : "s"}`, {
          fontSize: "11px",
          color: "#fff",
        })
        .setOrigin(0.5, 1),
    );
    if (grew) this.shout();
  }

  shout() {
    const { width: w } = this.scale;
    const cam = this.cameras.main;
    const can = this.add
      .image(cam.scrollX + w * 0.5, 150, "can", 0)
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
        .text(
          0,
          n * 22,
          `${this.current.asleep.includes(i) ? "💤" : "◐"} ${i.id}  ${i.title}`.slice(0, this.boardChars),
          {
            fontSize: "13px",
            color: "#eee",
          },
        )
        .setInteractive();
      t.on("pointerdown", () => void openCard(i));
      this.board.add(t);
    }
  }

  wander(a: Actor) {
    const gen = a.gen;
    const alive = () => a.gen === gen && a.role === "working" && this.actors.get(a.item.id) === a;
    const lot = this.lots.get(a.home) ?? this.lots.get(SHED)!;
    const W = a.home === SHED ? 2 : HOUSE_W;
    const houseL = lot.box.x + 10;
    const houseR = lot.box.x + W * TILE_PX - 10;
    const door = lot.box.x + (Math.floor(W / 2) + 0.5) * TILE_PX;
    const roll = Math.random();
    const to = roll < 0.2 && lot.door ? door : Phaser.Math.Between(houseL, houseR);
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
      this.swingDoor(lot, true, () =>
        this.tweens.add({
          targets: [a.body, a.label],
          alpha: 0,
          duration: 300,
          onComplete: () => this.swingDoor(lot, false),
        }),
      );
      this.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
        this.swingDoor(lot, true, () =>
          this.tweens.add({
            targets: [a.body, a.label],
            alpha: 1,
            duration: 300,
            onComplete: () => this.swingDoor(lot, false),
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

  snooze(a: Actor) {
    const gen = a.gen;
    const z = () => {
      if (a.gen !== gen || !this.actors.has(a.item.id)) return;
      const t = this.add
        .text(a.body.x + 10, a.body.y - 60, "z", { fontSize: "12px", color: "#fff" })
        .setDepth(6);
      this.tweens.add({
        targets: t,
        y: t.y - 30,
        x: t.x + 8,
        alpha: 0,
        duration: 1600,
        onComplete: () => t.destroy(),
      });
      this.time.delayedCall(900, z);
    };
    z();
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

  swingDoor(lot: Lot, open: boolean, then?: () => void) {
    const d = lot.door;
    if (!d) return then?.();
    lot.doorUsers += open ? 1 : -1;
    if (open ? lot.doorUsers > 1 : lot.doorUsers > 0) return then?.();
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
      this.settle(a);
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
    this.cameras.main.pan(this.ute.x, h / 2, 2500, Phaser.Math.Easing.Sine.InOut);
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
    this.cameras.main.pan(this.empties.x + 100, this.scale.height / 2, 1500, Phaser.Math.Easing.Sine.InOut);
    const { height: h } = this.scale;
    for (const a of this.actors.values()) {
      this.tweens.killTweensOf([a.body, a.label]);
      this.settle(a);
      a.role = "smoko";
      a.body.anims.stop();
      a.body.setFrame(2);
      this.tweens.add({
        targets: a.body,
        x: this.empties.x + 60 + Math.random() * 160,
        y: h * GROUND - 20,
        duration: 1200,
      });
    }
    this.kelpie.play("kelpie-run");
    this.tweens.add({
      targets: this.kelpie,
      x: { from: 100, to: this.worldW - 100 },
      duration: 1500,
      yoyo: true,
      repeat: 5,
      onYoyo: () => this.kelpie.setFlipX(true),
      onRepeat: () => this.kelpie.setFlipX(false),
    });
    this.time.delayedCall(10 * 60 * 1000, () => this.place(this.current));
  }
}
