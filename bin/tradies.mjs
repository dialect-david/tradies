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
    path.join(os.homedir(), ".config", "tradies.json"),
    path.join(site, ".tradies.json"),
  ];
  const cfg = {};
  for (const f of files) if (existsSync(f)) Object.assign(cfg, JSON.parse(readFileSync(f, "utf8")));
  return cfg;
}

function source(cfg) {
  const has = {
    beads: existsSync(path.join(site, ".beads")),
    openspec: existsSync(path.join(site, "openspec")),
  };
  if (cfg.source && has[cfg.source]) return cfg.source;
  return has.openspec && !has.beads ? "openspec" : "beads";
}

function doc() {
  const cfg = config();
  const word = (k, v) =>
    Array.isArray(v) ? v.map((x) => `\`${x}${k === "foremanLabels" ? "*" : ""}\``).join(" / ") : String(v);
  const file = source(cfg) === "openspec" ? "agents-openspec.md" : "agents.md";
  const text = readFileSync(path.join(pkg, "docs", file), "utf8").replace(/\{(\w+)\}/g, (m, k) =>
    k in cfg ? word(k, cfg[k]) : m,
  );
  return { text, source: source(cfg) };
}

if (cmd === "prime") {
  process.stdout.write(doc().text);
  process.exit(0);
}

if (cmd === "init") {
  const force = args.includes("--force");
  const { text, source: src } = doc();
  const what =
    src === "openspec" ? "OpenSpec changes, tasks and frontmatter" : "beads, labels, deps and close reasons";
  const skill = `---\nname: tradies\ndescription: How ${what} show up on the tradies site, and what it reads\n---\n\n${text}`;
  const root = args.includes("--repo") ? process.cwd() : os.homedir();
  for (const dir of [".claude/skills/tradies", ".agents/skills/tradies"]) {
    const file = path.join(root, dir, "SKILL.md");
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
