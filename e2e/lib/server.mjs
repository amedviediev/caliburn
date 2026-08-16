import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** ask the OS for a port nobody is using, then hand it to vite */
export const findFreePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const waitForHttp = async (url, { timeout, signalDead }) => {
  const deadline = Date.now() + timeout;
  let lastError = "no attempt made";
  while (Date.now() < deadline) {
    const dead = signalDead();
    if (dead) {
      throw new Error(`dev server exited before serving ${url}: ${dead}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `dev server not ready at ${url} after ${timeout}ms: ${lastError}`,
  );
};

/**
 * Boots the caliburn dev server on a free port. Spawned detached so the whole
 * process group (yarn -> vite -> esbuild workers) can be torn down together;
 * `stop()` is idempotent and safe to call from a `finally` or a signal handler.
 */
export const startDevServer = async ({ log = console.log } = {}) => {
  const port = await findFreePort();
  const url = `http://localhost:${port}/`;

  const child = spawn(
    "yarn",
    ["start", "--port", String(port), "--strictPort"],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0", BROWSER: "none" },
    },
  );

  let exited = null;
  const output = [];
  const record = (chunk) => {
    const text = String(chunk);
    output.push(text);
    if (output.length > 200) {
      output.shift();
    }
    if (process.env.E2E_SERVER_LOG) {
      process.stdout.write(`[vite] ${text}`);
    }
  };
  child.stdout.on("data", record);
  child.stderr.on("data", record);
  child.on("exit", (code, signal) => {
    exited = `code=${code} signal=${signal}`;
  });

  let stopped = false;
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    try {
      // negative pid => the whole detached process group
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
  };

  try {
    log(`booting dev server on ${url} ...`);
    await waitForHttp(url, { timeout: 120_000, signalDead: () => exited });
    log(`dev server ready on ${url}`);
  } catch (error) {
    stop();
    error.message += `\n--- dev server output ---\n${output.join("")}`;
    throw error;
  }

  return { url, port, stop, output };
};
