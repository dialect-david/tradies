import Phaser from "phaser";
import { Site } from "./scene.js";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#87ceeb",
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1400, height: 900 },
  scene: [Site],
});
