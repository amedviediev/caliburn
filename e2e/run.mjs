#!/usr/bin/env node
/**
 * `yarn e2e` — boots the caliburn dev server on a free port, drives it in a
 * real Chrome via puppeteer-core, prints the check table, and tears both down.
 *
 * Env:
 *   E2E_STRICT=<ids|all>  run known-broken entries strict (proves they catch)
 *   E2E_HEADFUL=1         watch it happen in a visible window
 *   E2E_SERVER_LOG=1      stream vite's output
 *   E2E_CHROME=<path>     Chrome binary (defaults to /Applications/Google Chrome.app)
 *   E2E_URL=<url>         reuse an already-running dev server instead of booting one
 */
import { ARTIFACTS, launchBrowser } from "./lib/browser.mjs";
import { Runner } from "./lib/runner.mjs";
import { startDevServer } from "./lib/server.mjs";
import { runSuite } from "./smoke.mjs";

let server = null;
let browser = null;

const shutdown = async () => {
  await browser?.close().catch(() => {});
  browser = null;
  server?.stop();
  server = null;
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    shutdown().finally(() => process.exit(130));
  });
}

let ok = false;
try {
  const url = process.env.E2E_URL ?? (server = await startDevServer()).url;
  browser = await launchBrowser();
  const runner = new Runner();
  const started = Date.now();
  await runSuite(browser, url, runner);
  ok = runner.report();
  console.log(
    `\nran in ${((Date.now() - started) / 1000).toFixed(
      1,
    )}s; artifacts: ${ARTIFACTS}`,
  );
} catch (error) {
  console.error("\ne2e harness crashed:", error);
  ok = false;
} finally {
  await shutdown();
}

process.exit(ok ? 0 : 1);
