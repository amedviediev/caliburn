import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACTS = path.resolve(HERE, "../artifacts");

/** no bundled Chromium: puppeteer-core drives the Chrome already on the machine */
const CHROME =
  process.env.E2E_CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const VIEWPORT = { width: 1440, height: 900 };

export const launchBrowser = async () => {
  await fs.rm(ARTIFACTS, { recursive: true, force: true });
  await fs.mkdir(ARTIFACTS, { recursive: true });
  return puppeteer.launch({
    executablePath: CHROME,
    headless: process.env.E2E_HEADFUL ? false : "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: VIEWPORT,
  });
};

/**
 * Page-side helpers, installed on every document (including reloads) so a
 * check can ask real questions about the rendered UI: is this overlay the
 * thing a user's cursor would actually hit, is its background actually
 * painted, where is it.
 */
const pageHelpers = () => {
  const describe = (el) =>
    el
      ? `${el.tagName.toLowerCase()}${
          el.className && typeof el.className === "string"
            ? `.${el.className.trim().split(/\s+/).join(".")}`
            : ""
        }`
      : "none";

  window.__e2e = {
    describe,
    /** geometry + the computed styles the overlay defects live in */
    probe(selector) {
      const el = document.querySelector(selector);
      if (!el) {
        return { selector, found: false };
      }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        selector,
        found: true,
        node: describe(el),
        rect: {
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
        },
        backgroundColor: cs.backgroundColor,
        opacity: cs.opacity,
        visibility: cs.visibility,
        display: cs.display,
        position: cs.position,
        zIndex: cs.zIndex,
        pointerEvents: cs.pointerEvents,
      };
    },
    /**
     * Does this element actually own its own pixels? `elementsFromPoint` at
     * the element's centre answers both "is it clickable" and "is anything
     * bleeding through it" in one shot — the two symptoms the mis-stacked
     * overlays produce.
     */
    occlusion(selector) {
      const el = document.querySelector(selector);
      if (!el) {
        return { selector, found: false };
      }
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      const stack = document.elementsFromPoint(x, y);
      const topmost = stack[0] ?? null;
      const ownIndex = stack.findIndex((n) => n === el || el.contains(n));
      return {
        selector,
        found: true,
        point: [Math.round(x), Math.round(y)],
        topmost: describe(topmost),
        ownsPoint: !!(topmost && (topmost === el || el.contains(topmost))),
        occludedBy: ownIndex > 0 ? stack.slice(0, ownIndex).map(describe) : [],
        stack: stack.slice(0, 6).map(describe),
      };
    },
    /** the appState fields the checks assert on (the full state is not cloneable) */
    appState() {
      const s = window.h?.state;
      if (!s) {
        return null;
      }
      return {
        scrollX: s.scrollX,
        scrollY: s.scrollY,
        zoom: s.zoom?.value,
        activeTool: s.activeTool?.type,
        openDialog: s.openDialog ? s.openDialog.name : null,
        openMenu: s.openMenu,
        openSidebar: s.openSidebar
          ? { name: s.openSidebar.name, tab: s.openSidebar.tab ?? null }
          : null,
        activeConfirmDialog: s.activeConfirmDialog ?? null,
        exportBackground: s.exportBackground,
        defaultSidebarDockedPreference: s.defaultSidebarDockedPreference,
        selectedElementIds: Object.keys(s.selectedElementIds ?? {}).length,
      };
    },
    elements() {
      return (window.h?.elements ?? [])
        .filter((el) => !el.isDeleted)
        .map((el) => ({ id: el.id, type: el.type }));
    },
    rect(selector) {
      const el = document.querySelector(selector);
      if (!el) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    },
    cssVar(selector, name) {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).getPropertyValue(name).trim() : null;
    },
  };
};

export const openPage = async (browser, url) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.evaluateOnNewDocument(pageHelpers);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".excalidraw", { timeout: 60_000 });
  await page.waitForFunction(() => !!window.h?.state, { timeout: 30_000 });
  // the editor measures its container on the first animation frames; wait for
  // the canvas to have been sized rather than sleeping blind
  await page.waitForFunction(
    () => document.querySelector("canvas.excalidraw__canvas.static")?.width > 0,
    { timeout: 30_000 },
  );
  page.__pageErrors = pageErrors;
  page.__context = context;
  return page;
};

export const closePage = async (page) => {
  await page.__context.close().catch(() => {});
};

/** poll a page-side predicate; never a bare sleep */
export const waitFor = async (
  page,
  fn,
  { message, timeout = 5000, args = [] } = {},
) => {
  try {
    await page.waitForFunction(fn, { timeout, polling: 50 }, ...args);
  } catch {
    throw new Error(
      message ?? `timed out waiting for ${fn.toString().slice(0, 120)}`,
    );
  }
};

/** let the modal's own fade-in finish before asserting on its painted state */
export const waitForAnimations = async (
  page,
  selector,
  { timeout = 3000 } = {},
) => {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return (
        !!el &&
        el
          .getAnimations()
          .every((animation) => animation.playState !== "running")
      );
    },
    { timeout, polling: 50 },
    selector,
  );
};

export const probe = (page, selector) =>
  page.evaluate((s) => window.__e2e.probe(s), selector);
export const occlusion = (page, selector) =>
  page.evaluate((s) => window.__e2e.occlusion(s), selector);
export const appState = (page) => page.evaluate(() => window.__e2e.appState());
export const elements = (page) => page.evaluate(() => window.__e2e.elements());
export const rectOf = (page, selector) =>
  page.evaluate((s) => window.__e2e.rect(s), selector);
export const cssVar = (page, selector, name) =>
  page.evaluate((s, n) => window.__e2e.cssVar(s, n), selector, name);

/** rgba()/rgb() alpha, 1 when the browser reports an opaque colour */
export const alphaOf = (color) => {
  const m = /rgba?\(([^)]+)\)/.exec(color ?? "");
  if (!m) {
    return color === "transparent" ? 0 : 1;
  }
  const parts = m[1].split(",").map((p) => parseFloat(p));
  return parts.length > 3 ? parts[3] : 1;
};

export const screenshot = async (page, name) => {
  const file = path.join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  return file;
};

/** put the editor back to a known state between checks in the same page */
export const resetEditor = async (page) => {
  await page.evaluate(() => {
    window.h.setState({
      openDialog: null,
      openMenu: null,
      openSidebar: null,
      activeConfirmDialog: null,
      selectedElementIds: {},
      scrollX: 0,
      scrollY: 0,
    });
    window.h.app.setActiveTool({ type: "selection" });
    window.h.elements = [];
  });
  await waitFor(page, () => document.querySelectorAll(".Modal").length === 0, {
    message: "modals still mounted after reset",
  });
};

/** press a key with the platform's primary modifier held */
export const pressWithMod = async (page, key) => {
  const mod = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.down(mod);
  await page.keyboard.press(key);
  await page.keyboard.up(mod);
};

/** click the real pixels at an element's centre — whatever is on top wins,
 * exactly as it would for a user */
export const clickCenter = async (page, selector) => {
  const r = await rectOf(page, selector);
  if (!r) {
    throw new Error(`clickCenter: ${selector} not found`);
  }
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
};

export const dragCanvas = async (page, from, to, { steps = 12 } = {}) => {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps });
  await page.mouse.up();
};
