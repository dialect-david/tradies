import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import * as bd from "./bd.js";
import * as gh from "./gh.js";
import { site } from "./shell.js";
import { loadConfig } from "./config.js";
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

async function act(a: Record<string, string>): Promise<string> {
  switch (a.type) {
    case "claim":
      await bd.claim(a.id);
      return `${a.id} on the tools`;
    case "close":
      await bd.close(a.id, a.text);
      return `${a.id} knocked off`;
    case "note":
      await bd.note(a.id, a.text);
      return `${a.id} noted`;
    case "merge":
      await gh.merge(a.id);
      return `${a.id} certified`;
    case "create":
      return `${await bd.quick(a.text ?? "", a.priority || "2", a.kind || "task")} pinned to the board`;
  }
  throw new Error(`unknown action ${a.type}`);
}

export function api(): Plugin {
  return {
    name: "tradies-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://x");
        try {
          if (url.pathname === "/items") {
            const [beads, prs, closed, epics, actor] = await Promise.all([
              bd.listBeads(),
              gh.listPrs(),
              bd.closedCount(),
              bd.epics(),
              bd.actor(),
            ]);
            return send(res, 200, {
              site: site.split("/").pop(),
              closed,
              epics,
              config: loadConfig(undefined, actor),
              items: [...beads, ...prs],
            });
          }
          if (url.pathname === "/knockoff") {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            return send(res, 200, { since: start, today: await bd.closedSince(start) });
          }
          if (url.pathname === "/show") {
            const id = url.searchParams.get("id") ?? "";
            return send(res, 200, id.startsWith("#") ? await gh.view(id) : await bd.show(id), "text/plain");
          }
          if (url.pathname === "/act" && req.method === "POST") {
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
