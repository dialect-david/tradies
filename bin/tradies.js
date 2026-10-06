#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
spawn("npx", ["tsx", path.join(root, "src/cli.tsx"), ...process.argv.slice(2)], { stdio: "inherit" });
