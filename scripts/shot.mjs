// usage: node scripts/shot.mjs <url> <out.png> [waitMs] [js to run before the shot]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [url, out, waitMs = "8000", js] = process.argv.slice(2);
const chrome = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    "--remote-debugging-port=9333",
    "--window-size=1400,900",
    "--hide-scrollbars",
    "--user-data-dir=/tmp/tradies-chrome",
    "about:blank",
  ],
  { stdio: "ignore" },
);
await new Promise((r) => setTimeout(r, 1500));
const targets = await (await fetch("http://127.0.0.1:9333/json")).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg.result);
  if (msg.method === "Runtime.consoleAPICalled")
    console.log(
      "console:",
      msg.params.args
        .map((a) => a.value ?? a.description)
        .join(" ")
        .slice(0, 200),
    );
  if (msg.method === "Runtime.exceptionThrown")
    console.log(
      "EXCEPTION:",
      msg.params.exceptionDetails.exception?.description?.slice(0, 400) ?? msg.params.exceptionDetails.text,
    );
};
const send = (method, params = {}) =>
  new Promise((r) => (pending.set(++id, r), ws.send(JSON.stringify({ id, method, params }))));
await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, Number(waitMs)));
if (js) {
  const r = await send("Runtime.evaluate", { expression: js, awaitPromise: true, returnByValue: true });
  console.log("eval:", JSON.stringify(r?.result?.value));
  await new Promise((r) => setTimeout(r, 800));
}
const { data } = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(data, "base64"));
console.log("wrote", out);
ws.close();
chrome.kill();
