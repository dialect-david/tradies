import Phaser from "phaser";
import { Site } from "./scene.js";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#87ceeb",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [Site],
});
