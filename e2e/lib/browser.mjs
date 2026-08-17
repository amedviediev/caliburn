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
    headless: !process.env.E2E_HEADFUL,
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
    /**
     * Where an element is actually mounted, and what it is stacked against.
     * `chain` is the ancestor walk up to `<body>`; `layers` is the paint order
     * inside the editor's own container; `hostLayers` is the paint order
     * inside whichever of those layers hosts this element. Together they are
     * the mount-point evidence a stacking defect has to be diagnosed from.
     */
    ancestry(selector) {
      const el = document.querySelector(selector);
      if (!el) {
        return { selector, found: false };
      }
      const layer = (node) => {
        const cs = getComputedStyle(node);
        return `${describe(node)} [position:${cs.position} z-index:${
          cs.zIndex
        }]`;
      };
      const chain = [];
      let editorHost = null;
      let node = el;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        chain.push({
          node: describe(node),
          position: cs.position,
          zIndex: cs.zIndex,
          opacity: cs.opacity,
          transform: cs.transform === "none" ? "none" : cs.transform,
          filter: cs.filter,
          isolation: cs.isolation,
          overflow: cs.overflow,
          pointerEvents: cs.pointerEvents,
        });
        if (node.parentElement?.classList.contains("excalidraw")) {
          editorHost = node;
        }
        node = node.parentElement;
      }
      const editor = el.closest(".excalidraw");
      return {
        selector,
        found: true,
        chain,
        layers: editor ? [...editor.children].map(layer) : [],
        hostLayers: editorHost ? [...editorHost.children].map(layer) : [],
        hostLayerName: editorHost ? describe(editorHost) : null,
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

/**
 * A phone: the viewport, device pixel ratio, touch support and user agent of
 * a Pixel-class handset. Applied before the first navigation so the editor
 * measures a phone-sized container on its very first frame, exactly as it
 * would on the device.
 */
export const PHONE = {
  viewport: {
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
};

/** the same handset turned on its side */
export const PHONE_LANDSCAPE = {
  ...PHONE.viewport,
  width: PHONE.viewport.height,
  height: PHONE.viewport.width,
  isLandscape: true,
};

/** a tablet — the form factor that drives the compact (not mobile) chrome */
export const TABLET = {
  width: 820,
  height: 1100,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  isLandscape: false,
};

export const openPage = async (browser, url, { emulate } = {}) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.evaluateOnNewDocument(pageHelpers);
  if (emulate) {
    await page.emulate(emulate);
  }
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

/**
 * Poll a page-side predicate; never a bare sleep. The underlying error is
 * always appended: a predicate that throws, or a crashed page, must never be
 * misreported as the product defect `message` describes.
 */
export const waitFor = async (
  page,
  fn,
  { message, timeout = 5000, args = [] } = {},
) => {
  try {
    await page.waitForFunction(fn, { timeout, polling: 50 }, ...args);
  } catch (error) {
    const what =
      message ?? `timed out waiting for ${fn.toString().slice(0, 120)}`;
    throw new Error(`${what} (${error.message.split("\n")[0]})`);
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
export const ancestry = (page, selector) =>
  page.evaluate((s) => window.__e2e.ancestry(s), selector);
export const appState = (page) => page.evaluate(() => window.__e2e.appState());
export const elements = (page) => page.evaluate(() => window.__e2e.elements());
export const rectOf = (page, selector) =>
  page.evaluate((s) => window.__e2e.rect(s), selector);
export const cssVar = (page, selector, name) =>
  page.evaluate((s, n) => window.__e2e.cssVar(s, n), selector, name);

/**
 * Everything a fix task needs about the node a defect lives at: mount point
 * (ancestry + the paint layers it competes in), computed styles, and the
 * hit-test winner. Gathered while the page is still open and stored on the
 * result, so `Runner.report()` can print it after teardown.
 */
export const collectEvidence = async (page, selectors) => {
  const out = [];
  for (const selector of selectors) {
    try {
      out.push({
        selector,
        probe: await probe(page, selector),
        occlusion: await occlusion(page, selector),
        ancestry: await ancestry(page, selector),
      });
    } catch (error) {
      out.push({ selector, error: error.message.split("\n")[0] });
    }
  }
  return out;
};

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

/** tap the real pixels at an element's centre with a finger, not a mouse */
export const tapCenter = async (page, selector) => {
  const r = await rectOf(page, selector);
  if (!r) {
    throw new Error(`tapCenter: ${selector} not found`);
  }
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
};

export const dragCanvas = async (page, from, to, { steps = 12 } = {}) => {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps });
  await page.mouse.up();
};
