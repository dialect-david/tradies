import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function sh(cmd: string, args: string[]): Promise<string> {
  const { stdout } = await run(cmd, args, { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

export async function json<T>(cmd: string, args: string[]): Promise<T> {
  const out = await sh(cmd, args);
  const start =
    out.indexOf("[") === -1
      ? out.indexOf("{")
      : Math.min(...[out.indexOf("["), out.indexOf("{")].filter((i) => i >= 0));
  return JSON.parse(out.slice(start)) as T;
}
