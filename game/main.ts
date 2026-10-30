import Phaser from "phaser";
import { Site } from "./scene.ts";
import { theme } from "./theme.ts";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: theme.sky,
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1400, height: 900 },
  scene: [Site],
});
