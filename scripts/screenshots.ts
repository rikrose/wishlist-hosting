/**
 * Regenerates the theme preview images in docs/themes/ from the dev-only
 * /demo page (bogus data). Run with:
 *
 *   pnpm run screenshots                 # starts its own dev server
 *   pnpm run screenshots -- --url http://localhost:3000   # reuse a running one
 *
 * Uses an installed Chrome or Edge through playwright-core. If you have
 * neither, run `pnpm dlx playwright install chromium` first.
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Browser } from "playwright-core";
import { THEME_IDS } from "../src/themes/registry.ts";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const PORT = 3123;
let base = urlFlag !== -1 ? args[urlFlag + 1]! : `http://localhost:${PORT}`;
let server: ChildProcess | undefined;

async function waitFor(url: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stopServer() {
  if (!server?.pid) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // already gone
    }
  } else {
    server.kill("SIGTERM");
  }
}

async function launch(): Promise<Browser> {
  for (const channel of ["chrome", "msedge", undefined]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch {
      // try the next one
    }
  }
  throw new Error(
    "No browser found. Install Chrome or Edge, or run `pnpm dlx playwright install chromium`.",
  );
}

try {
  if (urlFlag === -1) {
    console.log(`Starting dev server on port ${PORT}…`);
    // pnpm is a .cmd shim on Windows, which needs a shell (and a single command string).
    server =
      process.platform === "win32"
        ? spawn(`pnpm exec vp dev --port ${PORT} --strictPort`, { stdio: "ignore", shell: true })
        : spawn("pnpm", ["exec", "vp", "dev", "--port", String(PORT), "--strictPort"], {
            stdio: "ignore",
          });
  }
  base = base.replace(/\/$/, "");
  await waitFor(`${base}/demo`);

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  mkdirSync("docs/themes", { recursive: true });

  // Warm-up: the first dev-server load may re-optimise dependencies and reload.
  await page.goto(`${base}/demo`, { waitUntil: "networkidle" });
  await sleep(1500);

  for (const theme of THEME_IDS) {
    await page.goto(`${base}/demo?theme=${theme}&view=guest`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await sleep(300);
    const file = `docs/themes/${theme}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ✓ ${file}`);
  }
  await browser.close();
} finally {
  stopServer();
}
