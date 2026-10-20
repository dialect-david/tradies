import Phaser from "phaser";
import { Site } from "./scene.js";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#87ceeb",
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [Site],
});

let size = `${innerWidth}x${innerHeight}`;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (`${innerWidth}x${innerHeight}` !== size) location.reload();
  }, 400);
});
