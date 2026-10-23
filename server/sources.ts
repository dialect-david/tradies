import { existsSync } from "node:fs";
import path from "node:path";
import { beads } from "./beads.ts";
import { openspec } from "./openspec.ts";
import { demo } from "./demo.ts";
import { pickSource, type Source } from "./source.ts";
import type { SourceName } from "./defaults.ts";
import { site } from "./shell.ts";

export function currentSource(prefer?: SourceName): { name: SourceName; source: Source } {
  const name = pickSource(
    {
      beads: existsSync(path.join(site, ".beads")),
      openspec: existsSync(path.join(site, "openspec")),
      demo: process.env.TRADIES_DEMO === "1",
    },
    prefer,
  );
  return { name, source: { beads, openspec, demo }[name] };
}
