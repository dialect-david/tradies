import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export const site = process.env.INIT_CWD ?? process.cwd();

export async function sh(cmd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await run(cmd, args, { cwd: site, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error((err.stderr ?? "").trim().split("\n")[0] || err.message);
  }
}

export async function json<T>(cmd: string, args: string[]): Promise<T> {
  const out = await sh(cmd, args);
  const starts = [out.indexOf("["), out.indexOf("{")].filter((i) => i >= 0);
  return JSON.parse(out.slice(Math.min(...starts))) as T;
}
