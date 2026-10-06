import Phaser from "phaser";
import type { Item } from "../server/model.js";
import { cast, TRADE_COLOUR, type Cast } from "./cast.js";
import { items as fetchItems, onRefresh } from "./client.js";
import { openCard, toast } from "./card.js";

const GROUND = 0.78;

type Actor = { item: Item; body: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; role: string };

export class Site extends Phaser.Scene {
  private actors = new Map<string, Actor>();
  private board!: Phaser.GameObjects.Container;
  private boardRows: Item[] = [];
  private boardTop = 0;
  private kelpie!: Phaser.GameObjects.Rectangle;
  private rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private house!: Phaser.GameObjects.Rectangle;
  private hud = document.getElementById("hud")!;
  private current: Cast = cast([]);

  create() {
    const { width: w, height: h } = this.scale;
    this.add.rectangle(w / 2, h * GROUND, w, h * (1 - GROUND), 0x5d4a2a).setOrigin(0.5, 0);
    this.house = this.add.rectangle(w * 0.2, h * GROUND, 200, 20, 0xaaaaaa).setOrigin(0.5, 1);
    this.add.text(w * 0.2, h * GROUND + 8, "the house", { color: "#ccc" }).setOrigin(0.5, 0);
    this.add.rectangle(w * 0.85, h * GROUND - 20, 120, 40, 0x8b0000).setStrokeStyle(2, 0xffffff);
    this.add.text(w * 0.85, h * GROUND - 20, "esky", { color: "#fff" }).setOrigin(0.5);

    this.add.rectangle(w / 2, h * 0.35, 460, 260, 0x111111, 0.85).setStrokeStyle(3, 0xffffff);
    this.add
      .text(w / 2, h * 0.35 - 150, "ON THE TOOLS", { color: "#fff", fontSize: "18px", fontStyle: "bold" })
      .setOrigin(0.5);
    this.board = this.add.container(w / 2 - 215, h * 0.35 - 120);
    this.time.addEvent({ delay: 2500, loop: true, callback: () => this.drawBoard(this.boardTop + 1) });

    this.rain = this.add.particles(0, 0, "drop", {
      x: { min: 0, max: w },
      y: -10,
      lifespan: 1400,
      speedY: { min: 500, max: 700 },
      quantity: 6,
      frequency: 40,
      emitting: false,
    });

    this.kelpie = this.add
      .rectangle(w * 0.5, h * GROUND, 28, 18, 0x8b4513)
      .setOrigin(0.5, 1)
      .setInteractive();
    this.kelpie.on("pointerdown", () => {
      toast("good girl");
      this.tweens.add({ targets: this.kelpie, y: h * GROUND - 30, duration: 150, yoyo: true });
    });

    this.hud.innerHTML = `<span id="site"></span><span id="counts"></span><button id="smoko">smoko</button><span id="clock"></span>`;
    this.hud.querySelector("#smoko")!.addEventListener("click", () => this.smoko());

    void this.refresh();
    onRefresh(() => void this.refresh());
  }

  preload() {
    const g = this.make.graphics({}, false);
    g.fillStyle(0x7fb3ff).fillRect(0, 0, 2, 10);
    g.generateTexture("drop", 2, 10);
  }

  async refresh() {
    try {
      const { site, items } = await fetchItems();
      this.current = cast(items);
      this.hud.querySelector("#site")!.textContent = `🏗 ${site}`;
      this.place(this.current);
    } catch (e) {
      toast(`strewth: ${(e as Error).message}`);
    }
  }

  place(c: Cast) {
    const { width: w, height: h } = this.scale;
    const seen = new Set<string>();
    const spot = (role: string, n: number) =>
      role === "working"
        ? [w * 0.08 + n * 40, h * GROUND]
        : role === "waiting"
          ? [w * 0.45 + (n % 12) * 28, h * GROUND - Math.floor(n / 12) * 34]
          : [w * 0.78 + (n % 8) * 18, h * GROUND - 44 - Math.floor(n / 8) * 16];

    const put = (item: Item, role: string, n: number) => {
      seen.add(item.id);
      const [x, y] = spot(role, n);
      let a = this.actors.get(item.id);
      if (!a) {
        const body = this.add
          .rectangle(x, h * -0.1, 16, role === "smoko" ? 12 : 28, TRADE_COLOUR[item.trade] ?? 0xffffff)
          .setOrigin(0.5, 1)
          .setInteractive();
        const label = this.add
          .text(x, y + 2, item.id.replace(/^[a-z]+-/, ""), { fontSize: "9px", color: "#ddd" })
          .setOrigin(0.5, 0);
        body.on("pointerdown", () => void openCard(item));
        body.on("pointerover", () => label.setText(item.title.slice(0, 40)));
        body.on("pointerout", () => label.setText(item.id.replace(/^[a-z]+-/, "")));
        a = { item, body, label, role };
        this.actors.set(item.id, a);
      }
      a.item = item;
      a.role = role;
      this.tweens.add({ targets: a.body, x, y, duration: 600, ease: "Bounce.Out" });
      this.tweens.add({ targets: a.label, x, y: y + 2, duration: 600 });
      if (role === "working") this.wander(a);
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

    c.rain ? this.rain.start() : this.rain.stop();
    this.hud.querySelector("#counts")!.textContent =
      `${c.working.length} on the tools · ${c.ready} ready · ${c.waiting.length} waiting on materials · ${c.smoko.length} on smoko · ${c.inspectors.length} inspectors${c.rain ? " · ☔ rain" : ""}`;

    const target = c.worst && this.actors.get(c.worst.id);
    const tx = target ? target.body.x + 20 : w * 0.5;
    this.tweens.add({
      targets: this.kelpie,
      x: tx,
      duration: Math.abs(tx - this.kelpie.x) * 2 + 200,
      ease: "Sine.InOut",
    });
    if (c.worst?.priority === 0 || c.rain) toast("woof! " + (c.worst?.id ?? ""));
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
    const dx = Phaser.Math.Between(-30, 30);
    this.tweens.add({
      targets: [a.body, a.label],
      x: `+=${dx}`,
      duration: Phaser.Math.Between(1500, 4000),
      delay: Phaser.Math.Between(0, 2000),
      ease: "Sine.InOut",
      onComplete: () => a.role === "working" && this.actors.get(a.item.id) === a && this.wander(a),
    });
  }

  smoko() {
    toast("smoko. ten minutes.");
    const { width: w, height: h } = this.scale;
    for (const a of this.actors.values())
      this.tweens.add({
        targets: a.body,
        x: w * 0.85 - 60 + Math.random() * 120,
        y: h * GROUND - 40,
        duration: 1200,
      });
    this.tweens.add({
      targets: this.kelpie,
      x: { from: w * 0.1, to: w * 0.9 },
      duration: 1500,
      yoyo: true,
      repeat: 5,
    });
    this.time.delayedCall(10 * 60 * 1000, () => this.place(this.current));
  }
}
