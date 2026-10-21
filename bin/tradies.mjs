#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = () => readFileSync(path.join(pkg, "docs", "agents.md"), "utf8");
const args = process.argv.slice(2);
const [cmd] = args;

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
const site = path.resolve(args.find((a) => !a.startsWith("--")) ?? process.cwd());

const child = spawn(process.execPath, [vite], {
  cwd: pkg,
  stdio: "inherit",
  env: { ...process.env, TRADIES_SITE: site, ...(demo ? { TRADIES_DEMO: "1" } : {}) },
});
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, sig) => process.exit(code ?? (sig ? 1 : 0)));
