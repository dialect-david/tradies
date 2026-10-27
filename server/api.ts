import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { currentSource } from "./sources.ts";
import type { Action } from "./source.ts";
import * as gh from "./gh.ts";
import * as git from "./git.ts";
import { site } from "./shell.ts";
import { loadConfig } from "./config.ts";
import { dataChecks, readiness } from "./doctor.ts";
import { watch } from "node:fs";
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

const { name: sourceName, source } = currentSource(loadConfig().source);
const DEMO_NAMES: Record<string, string> = { "1": "brew", openspec: "specs" };
const siteName = () => DEMO_NAMES[process.env.TRADIES_DEMO ?? ""] ?? site.split("/").pop();

export const ACTIONS: Record<string, Action> = {
  merge: { run: (id) => gh.merge(id).then(() => id), done: "certified" },
  ...source.actions,
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
              source.prs?.() ?? gh.listPrs(config.prs),
              source.closedCount(),
              source.houses(config),
            ]);
            return send(res, 200, {
              site: siteName(),
              source: sourceName,
              demo: !!process.env.TRADIES_DEMO,
              closed,
              epics,
              actions: Object.keys(ACTIONS),
              prompts: source.prompts,
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
          if (url.pathname === "/doctor") {
            const cfg = loadConfig();
            const [items, houses, closed, prs] = await Promise.all([
              source.items(),
              source.houses(cfg),
              source.closedRecent(),
              source.prs?.() ?? gh.listPrs(cfg.prs),
            ]);
            const checks = dataChecks({ items, houses, closed, prs, cfg, source: sourceName });
            return send(res, 200, { checks, readiness: readiness(checks) });
          }
          if (url.pathname === "/show") {
            const id = url.searchParams.get("id") ?? "";
            const view = async (id: string) => source.view?.(id) ?? gh.view(id, await source.items());
            return send(res, 200, await (id.startsWith("#") ? view : source.show)(id));
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
