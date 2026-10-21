#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const [cmd] = args;
const SUB = new Set(["prime", "init"]);
const site = path.resolve(args.find((a) => !a.startsWith("--") && !SUB.has(a)) ?? process.cwd());

function config() {
  const files = [
    path.join(pkg, "config.json"),
    path.join(site, ".tradies.json"),
    path.join(os.homedir(), ".config", "tradies.json"),
  ];
  const cfg = {};
  for (const f of files) if (existsSync(f)) Object.assign(cfg, JSON.parse(readFileSync(f, "utf8")));
  return cfg;
}

function doc() {
  const cfg = config();
  const word = (k, v) =>
    Array.isArray(v) ? v.map((x) => `\`${x}${k === "foremanLabels" ? "*" : ""}\``).join(" / ") : String(v);
  return readFileSync(path.join(pkg, "docs", "agents.md"), "utf8").replace(/\{(\w+)\}/g, (m, k) =>
    k in cfg ? word(k, cfg[k]) : m,
  );
}

if (cmd === "prime") {
  process.stdout.write(doc());
  process.exit(0);
}

if (cmd === "init") {
  const force = args.includes("--force");
  const skill = `---\nname: tradies\ndescription: How beads and PRs show up on the tradies site; the labels, deps and close reasons it reads\n---\n\n${doc()}`;
  for (const dir of [".claude/skills/tradies", ".agents/skills/tradies"]) {
    const file = path.join(process.cwd(), dir, "SKILL.md");
    if (existsSync(file) && !force) {
      console.error(`${file} exists; use --force to overwrite`);
      process.exit(1);
    }
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, skill);
    console.log(`wrote ${file}`);
  }
  process.exit(0);
}

const vite = path.join(
  path.dirname(createRequire(import.meta.url).resolve("vite")),
  "..",
  "..",
  "bin",
  "vite.js",
);
const demo = args.includes("--demo");

const child = spawn(process.execPath, [vite], {
  cwd: pkg,
  stdio: "inherit",
  env: { ...process.env, TRADIES_SITE: site, ...(demo ? { TRADIES_DEMO: "1" } : {}) },
});
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, sig) => process.exit(code ?? (sig ? 1 : 0)));
