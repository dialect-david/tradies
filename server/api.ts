import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { beads } from "./beads.js";
import { openspec } from "./openspec.js";
import { pickSource, type Action } from "./source.js";
import * as gh from "./gh.js";
import * as git from "./git.js";
import { site } from "./shell.js";
import { loadConfig } from "./config.js";
import { existsSync, watch } from "node:fs";
import path from "node:path";

type Res = ServerResponse<IncomingMessage>;
const listeners = new Set<Res>();

function send(res: Res, status: number, body: unknown, type = "application/json") {
  res.writeHead(status, { "content-type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : String(body));
}

function notify() {
  for (const r of listeners) r.write("data: refresh\n\n");
}

async function body(req: IncomingMessage): Promise<Record<string, string>> {
  let s = "";
  for await (const c of req) s += c;
  return s ? (JSON.parse(s) as Record<string, string>) : {};
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

const source = {
  beads,
  openspec,
}[
  pickSource(
    { beads: existsSync(path.join(site, ".beads")), openspec: existsSync(path.join(site, "openspec")) },
    loadConfig().source,
  )
];

export const ACTIONS: Record<string, Action> = {
  ...source.actions,
  merge: { run: (id) => gh.merge(id).then(() => id), done: "certified" },
};

async function act(a: Record<string, string>): Promise<string> {
  const action = ACTIONS[a.type];
  if (!action) throw new Error(`unknown action ${a.type}`);
  return `${await action.run(a.id, a)} ${action.done}`;
}

export function api(): Plugin {
  return {
    name: "tradies-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://x");
        try {
          if (url.pathname === "/items") {
            const actor = await source.actor();
            const config = loadConfig(undefined, actor);
            const [items, prs, closed, epics] = await Promise.all([
              source.items(),
              gh.listPrs(),
              source.closedCount(),
              source.houses(config),
            ]);
            return send(res, 200, {
              site: site.split("/").pop(),
              closed,
              epics,
              actions: Object.keys(ACTIONS),
              config,
              review: await git.review(config.reviewAfter),
              items: [...items, ...prs],
            });
          }
          if (url.pathname === "/knockoff") {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            return send(res, 200, { since: start, today: await source.closedSince(start) });
          }
          if (url.pathname === "/closed") return send(res, 200, await source.closedRecent());
          if (url.pathname === "/show") {
            const id = url.searchParams.get("id") ?? "";
            return send(
              res,
              200,
              id.startsWith("#") ? await gh.view(id) : await source.show(id),
              "text/plain",
            );
          }
          if (url.pathname === "/act" && req.method === "POST") {
            if (!sameOrigin(req)) return send(res, 403, { error: "cross-origin action refused" });
            const msg = await act(await body(req));
            notify();
            return send(res, 200, { msg });
          }
          if (url.pathname === "/events") {
            res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
            res.write("data: hello\n\n");
            listeners.add(res);
            req.on("close", () => listeners.delete(res));
            return;
          }
          send(res, 404, { error: "no such path" });
        } catch (e) {
          send(res, 500, { error: (e as Error).message });
        }
      });
      setInterval(notify, 30_000).unref();
      let timer: NodeJS.Timeout | undefined;
      if (source.watchPath)
        try {
          watch(source.watchPath, () => {
            clearTimeout(timer);
            timer = setTimeout(notify, 300);
          }).unref();
        } catch {
          /* nothing to watch; the 30s tick still runs */
        }
    },
  };
}
