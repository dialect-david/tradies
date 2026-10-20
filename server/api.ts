import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import * as bd from "./bd.js";
import * as gh from "./gh.js";
import * as git from "./git.js";
import { site } from "./shell.js";
import { loadConfig } from "./config.js";
import { houses } from "./houses.js";
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

/** run does the work and returns the id to name in the toast. */
type Action = { run: (id: string, a: Record<string, string>) => Promise<string>; done: string };

export const ACTIONS: Record<string, Action> = {
  claim: { run: (id) => bd.claim(id).then(() => id), done: "on the tools" },
  close: { run: (id, a) => bd.close(id, a.text).then(() => id), done: "knocked off" },
  note: { run: (id, a) => bd.note(id, a.text).then(() => id), done: "noted" },
  merge: { run: (id) => gh.merge(id).then(() => id), done: "certified" },
  create: {
    run: (_, a) => bd.quick(a.text ?? "", a.priority || "2", a.kind || "task"),
    done: "pinned to the board",
  },
};

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

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
            const [beads, prs, closed, all, actor] = await Promise.all([
              bd.listBeads(),
              gh.listPrs(),
              bd.closedCount(),
              bd.allBeads(),
              bd.actor(),
            ]);
            const config = loadConfig(undefined, actor);
            return send(res, 200, {
              site: site.split("/").pop(),
              closed,
              epics: houses(all, config),
              config,
              review: await git.review(config.reviewAfter),
              items: [...beads, ...prs],
            });
          }
          if (url.pathname === "/knockoff") {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            return send(res, 200, { since: start, today: await bd.closedSince(start) });
          }
          if (url.pathname === "/closed") return send(res, 200, await bd.closedRecent());
          if (url.pathname === "/show") {
            const id = url.searchParams.get("id") ?? "";
            return send(res, 200, id.startsWith("#") ? await gh.view(id) : await bd.show(id), "text/plain");
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
      try {
        watch(path.join(site, ".beads"), () => {
          clearTimeout(timer);
          timer = setTimeout(notify, 300);
        }).unref();
      } catch {
        /* no .beads here; the 30s tick still runs */
      }
    },
  };
}
