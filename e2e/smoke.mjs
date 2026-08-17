/**
 * Real-browser interactive smoke suite for the caliburn app.
 *
 * Every check clicks, types and drags the way a person does, then asserts a
 * real outcome: appState read through the editor's `window.h` test hook,
 * element counts, bounding boxes, computed styles, and `elementsFromPoint`
 * occlusion (the honest answer to both "is this clickable" and "is anything
 * bleeding through it"). Screenshots are failure artifacts only — nothing is
 * asserted by comparing pixels.
 *
 * Each check declares `evidence.selectors`: the DOM nodes its defect lives at.
 * On failure the runner probes them while the page is still open and prints
 * mount point, computed styles and hit-test winner, so the run's own output is
 * the diagnosis.
 */
import {
  alphaOf,
  appState,
  clickCenter,
  closePage,
  cssVar,
  dragCanvas,
  elements,
  occlusion,
  openPage,
  penTapAt,
  PHONE,
  PHONE_LANDSCAPE,
  pressWithMod,
  probe,
  rectOf,
  resetEditor,
  restoreNativeEvent,
  screenshot,
  settleTapTwiceWindow,
  suppressNativeEvent,
  TABLET,
  tapCenter,
  VIEWPORT,
  waitFor,
  waitForAnimations,
} from "./lib/browser.mjs";
import { expect, expectEqual } from "./lib/runner.mjs";

/** the testid-addressable action items the app's main menu renders */
const MAIN_MENU_ITEMS = [
  "load-button",
  "json-export-button",
  "image-export-button",
  "collab-button",
  "command-palette-button",
  "search-menu-button",
  "help-menu-item",
  "clear-canvas-button",
  "preferences-menu-item",
];

/**
 * `SaveToActiveFile` is deliberately not in the list above: upstream renders
 * it only while `appState.fileHandle` is set (`actionSaveToActiveFile`'s
 * predicate), so its own check drives that condition instead.
 */
const SAVE_TO_ACTIVE_FILE_ITEM = "save-button";

/**
 * The Preferences submenu's rows, in upstream's order (`DefaultItems.tsx`).
 * `shortcut: null` means "upstream wires one, assert it rendered" — the text
 * itself is platform-dependent (`getShortcutKey` prints Alt as Option and
 * CtrlOrCmd as Cmd on darwin); `""` means upstream wires none.
 */
const PREFERENCES_ITEMS = [
  { testid: "preferences-tool-lock", shortcut: "Q" },
  { testid: "preferences-objects-snap-mode", shortcut: null },
  { testid: "preferences-grid-mode", shortcut: null },
  { testid: "preferences-zen-mode", shortcut: null },
  { testid: "preferences-view-mode", shortcut: null },
  { testid: "preferences-element-properties", shortcut: null },
  { testid: "preferences-arrow-binding", shortcut: "" },
  { testid: "preferences-midpoint-snapping", shortcut: "" },
];

/**
 * The extra-tools dropdown, in upstream `Toolbar.tsx`'s order. The mermaid
 * entry carries `toolbar-embeddable` because upstream's own copy/paste does;
 * matching on the label keeps the two apart.
 */
const EXTRA_TOOLS_ITEMS = [
  { testid: "toolbar-frame", label: "Frame tool", shortcut: "F" },
  { testid: "toolbar-embeddable", label: "Web Embed", shortcut: "" },
  // Shift+X, whose rendering is platform-dependent — asserted as non-empty
  { testid: "toolbar-autoshape", label: "Draw to shape", shortcut: null },
  { testid: "toolbar-laser", label: "Laser pointer", shortcut: "K" },
  { testid: "toolbar-bucketfill", label: "Bucket fill", shortcut: "B" },
  { testid: "toolbar-lasso", label: "Lasso selection", shortcut: "" },
  {
    testid: "toolbar-embeddable",
    label: "Mermaid to Excalidraw",
    shortcut: "",
  },
];

/**
 * ...and the rest of what `app-main-menu.component.html` renders below them.
 * Without these the inventory check stopped at `clear-canvas-button` and the
 * whole links/branding region went uncovered.
 */
const MAIN_MENU_REGIONS = [
  {
    name: "separators",
    selector: ".dropdown-menu-container caliburn-dropdown-menu-separator",
    count: 2,
  },
  {
    name: "socials links",
    selector: ".dropdown-menu-container caliburn-menu-socials a",
    count: 1,
  },
  {
    // scoped to the theme item's own host: the Preferences submenu renders a
    // second RadioGroup inside its own `.dropdown-menu-container`, so an
    // unscoped count is ambiguous whenever that submenu happens to be open
    name: "theme choices",
    selector:
      ".dropdown-menu-container caliburn-menu-toggle-theme .RadioGroup__choice",
    count: 3,
  },
  {
    name: "language picker",
    selector: ".dropdown-menu-container select.dropdown-select__language",
    count: 1,
  },
  {
    name: "canvas background label",
    selector:
      '.dropdown-menu-container [data-testid="canvas-background-label"]',
    count: 1,
  },
  {
    name: "canvas background top picks",
    selector: '.dropdown-menu-container [data-testid^="color-top-pick"]',
    count: 5,
  },
];

/** hosts whose appearance in a menu link means the app still points at
 * upstream Excalidraw's properties rather than its own */
const UPSTREAM_LINK_MARKERS = [
  "excalidraw.com",
  "github.com/excalidraw",
  "x.com/excalidraw",
  "twitter.com/excalidraw",
  "discord.gg/UexuTaE",
  "youtube.com/@excalidraw",
];

const occlusionDetail = async (page, selector) => {
  const info = await occlusion(page, selector);
  if (!info.found) {
    return `${selector} is not in the DOM`;
  }
  return info.ownsPoint
    ? `${selector} does own the pixels at ${JSON.stringify(info.point)}`
    : `${selector} does not own the pixels at its centre ${JSON.stringify(
        info.point,
      )} — topmost is ${info.topmost}; occluded by [${info.occludedBy.join(
        ", ",
      )}]`;
};

/** an overlay must own the pixels at its own centre, or it is neither
 * clickable nor visually solid */
const expectOwnsPixels = async (page, selector, what) => {
  const info = await occlusion(page, selector);
  expect(info.found, `${what}: ${selector} is not in the DOM`);
  expect(info.ownsPoint, `${what}: ${await occlusionDetail(page, selector)}`);
};

/**
 * Click an element's real pixels and wait for the outcome it is supposed to
 * produce. On failure the message carries both the occlusion report and the
 * underlying wait error, so an unclickable control reads as "the canvas ate
 * the click" and a broken predicate reads as itself.
 */
const clickAndExpect = async (
  page,
  selector,
  predicate,
  { message, args = [], timeout = 3000 },
) => {
  await clickCenter(page, selector);
  try {
    await waitFor(page, predicate, {
      args,
      timeout,
      message: "outcome never happened",
    });
  } catch (error) {
    throw new Error(
      `${message} [${await occlusionDetail(page, selector)}] (${
        error.message
      })`,
    );
  }
};

const expectOpaque = async (page, selector, what) => {
  const info = await probe(page, selector);
  expect(info.found, `${what}: ${selector} is not in the DOM`);
  const alpha = alphaOf(info.backgroundColor);
  expect(
    alpha === 1,
    `${what}: ${selector} background-color is ${info.backgroundColor} (alpha ${alpha})`,
  );
  expect(
    Number(info.opacity) === 1,
    `${what}: ${selector} opacity is ${info.opacity}`,
  );
};

const openMainMenu = async (page) => {
  await clickCenter(page, '[data-testid="main-menu-trigger"]');
  await waitFor(
    page,
    () => !!document.querySelector('[data-testid="dropdown-menu"]'),
    {
      message: "main menu did not open",
    },
  );
};

const openHelpDialog = async (page) => {
  await openMainMenu(page);
  await clickCenter(page, '[data-testid="help-menu-item"]');
  await waitFor(page, () => !!document.querySelector(".Modal.HelpDialog"), {
    message: "help dialog did not mount",
  });
  // the dialog moves focus into itself on a macrotask after view init
  await waitFor(
    page,
    () =>
      document
        .querySelector(".Modal.HelpDialog")
        ?.contains(document.activeElement),
    { message: "help dialog never took focus" },
  );
  await waitForAnimations(page, ".HelpDialog .Modal__content");
};

/** the dev-only visual debugger: its main-menu toggle, the overlay it mounts
 * and the footer stepper's one unambiguously addressable button (upstream
 * labels the other three "debug-forward" alike) */
const VISUAL_DEBUG_ITEM = '[data-testid="visual-debug-menu-item"]';
const DEBUG_CANVAS = ".excalidraw caliburn-debug-canvas canvas";
const DEBUG_STEP_FORWARD = '[data-testid="debug-backward"]';

/**
 * The overlay's painted pixels inside the box the visual-debug check draws
 * into. Runs in the page, so it has to stay self-contained.
 */
const paintedDebugPixels = (sel) => {
  const canvas = document.querySelector(sel);
  if (!canvas) {
    return -1;
  }
  const dpr = window.devicePixelRatio;
  const box = canvas
    .getContext("2d")
    .getImageData(
      Math.round(270 * dpr),
      Math.round(270 * dpr),
      Math.round(60 * dpr),
      Math.round(60 * dpr),
    );
  let painted = 0;
  for (let i = 3; i < box.data.length; i += 4) {
    if (box.data[i] > 0) {
      painted += 1;
    }
  }
  return painted;
};

/** the debug renderer is throttled to an animation frame, so the repaint
 * lands after the click that asked for it */
const waitForDebugPaint = async (page) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await page.evaluate(paintedDebugPixels, DEBUG_CANVAS)) > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("the pushed debug primitives never reached the overlay");
};

const LANGUAGE_PICKER =
  ".dropdown-menu-container select.dropdown-select__language";

/** the main menu's canvas-background heading, the label a language switch is
 * read off */
const backgroundLabel = (page) =>
  page.evaluate(() =>
    document
      .querySelector('[data-testid="canvas-background-label"]')
      ?.textContent?.trim(),
  );

const drawRectangle = async (page, from = [500, 400], to = [700, 550]) => {
  await clickCenter(page, '[data-testid="toolbar-rectangle"]');
  await waitFor(page, () => window.h.state.activeTool.type === "rectangle", {
    message: "rectangle tool was not activated by the toolbar click",
  });
  await dragCanvas(page, from, to);
  await waitFor(page, () => window.__e2e.elements().length === 1, {
    message: "dragging on the canvas did not create an element",
  });
};

/**
 * Put a real image on the canvas the way a user does — by dropping a file on
 * it, so the app's own pipeline decodes the bitmap and fills `imageCache`,
 * which is what the crop editor measures the image against. The file is
 * painted in the page rather than read off disk, so the check carries no
 * fixture; JPEG keeps the drop out of the `loadFromBlob` branch that a PNG
 * (a possible Excalidraw scene container) is put through first.
 */
const dropImage = async (page, [clientX, clientY]) => {
  await page.evaluate(
    async (x, y) => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#4a90d9";
      ctx.fillRect(0, 0, 400, 400);
      ctx.fillStyle = "#e6a03c";
      ctx.fillRect(0, 0, 200, 200);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg"),
      );
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(
        new File([blob], "crop.jpg", { type: "image/jpeg" }),
      );
      document
        .querySelector("canvas.excalidraw__canvas.interactive")
        .dispatchEvent(
          new DragEvent("drop", {
            dataTransfer,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }),
        );
    },
    clientX,
    clientY,
  );
  await waitFor(
    page,
    () => {
      const el = (window.h?.elements ?? []).filter((e) => !e.isDeleted)[0];
      const cached = el && window.h.app.imageCache.get(el.fileId);
      return (
        !!el &&
        el.type === "image" &&
        el.status === "saved" &&
        !!cached?.image?.naturalWidth
      );
    },
    { message: "dropping an image file did not insert a decoded image" },
  );
};

/** the dropped image's own box, plus the viewport points a drag needs */
const imageGeometry = (page) =>
  page.evaluate(() => {
    const el = window.h.elements.filter((e) => !e.isDeleted)[0];
    const { scrollX, scrollY, zoom, offsetLeft, offsetTop } = window.h.state;
    const toViewport = (x, y) => [
      (x + scrollX) * zoom.value + offsetLeft,
      (y + scrollY) * zoom.value + offsetTop,
    ];
    return {
      element: {
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        crop: el.crop,
      },
      west: toViewport(el.x, el.y + el.height / 2),
      centre: toViewport(el.x + el.width / 2, el.y + el.height / 2),
    };
  });

/** the scene's first element's box — the geometry `elements()` leaves out */
const elementBox = (page) =>
  page.evaluate(() => {
    const el = (window.h?.elements ?? []).filter((e) => !e.isDeleted)[0];
    return el ? { x: el.x, y: el.y, width: el.width, height: el.height } : null;
  });

/** every non-deleted element's position — `__e2e.elements()` carries only
 * id and type */
const elementPositions = (page) =>
  page.evaluate(() =>
    (window.h?.elements ?? [])
      .filter((el) => !el.isDeleted)
      .map((el) => ({ x: el.x, y: el.y })),
  );

/** the cursor the editor has painted on the interactive canvas */
const canvasCursor = (page) =>
  page.evaluate(
    () => document.querySelector("canvas.interactive")?.style.cursor ?? null,
  );

/** a scene point in the client coords the mouse is driven with */
const sceneToViewport = (page, [sceneX, sceneY]) =>
  page.evaluate(
    ([x, y]) => {
      const { zoom, scrollX, scrollY, offsetLeft, offsetTop } = window.h.state;
      return [
        (x + scrollX) * zoom.value + offsetLeft,
        (y + scrollY) * zoom.value + offsetTop,
      ];
    },
    [sceneX, sceneY],
  );

/** a toolbar button's icon — the `<svg>` a drag crossing the toolbar passes over */
const TOOLBAR_ICON = '[data-testid="toolbar-ellipse"] svg';

/** the styles panel's align row, which only renders for a multi-selection */
const ALIGN_LEFT_BUTTON = '.excalidraw button[aria-label="Align left"]';

const readLinksIn = (page, containerSelector) =>
  page.evaluate(
    (selector) =>
      [...document.querySelectorAll(`${selector} a[href]`)].map((a) => ({
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
        rel: a.getAttribute("rel"),
        ariaLabel: a.getAttribute("aria-label"),
        label: a.textContent.trim(),
      })),
    containerSelector,
  );

const readMenuLinks = (page) =>
  readLinksIn(page, ".dropdown-menu-container caliburn-menu-socials");

const upstreamLinks = (links) =>
  links
    .filter((link) =>
      UPSTREAM_LINK_MARKERS.some((marker) =>
        (link.href ?? "").includes(marker),
      ),
    )
    .map((link) => `${link.label} -> ${link.href}`);

export const runSuite = async (browser, url, runner) => {
  const withPage = async (name, body, { emulate } = {}) => {
    const page = await openPage(browser, url, { emulate });
    try {
      await body(page);
    } finally {
      // per group, not once at boot: a check that trips an uncaught exception
      // has broken the app even if its own assertion happened to pass
      await runner.check(
        `${name}.no-page-errors`,
        `${name} flows raise no uncaught page errors`,
        () =>
          expectEqual(
            page.__pageErrors.length,
            0,
            `uncaught page errors: ${page.__pageErrors.join(" | ")}`,
          ),
      );
      await screenshot(page, `${name}-final`);
      await closePage(page);
    }
  };

  // ---------------------------------------------------------------- baseline
  await withPage("baseline", async (page) => {
    runner.group("baseline flows (strict)");

    await runner.check(
      "baseline.editor-boots",
      "editor boots with a live canvas and test hook",
      async () => {
        const container = await rectOf(page, ".excalidraw");
        expect(container, ".excalidraw container missing");
        expectEqual(container.width, VIEWPORT.width, "container width");
        expectEqual(container.height, VIEWPORT.height, "container height");
        const state = await appState(page);
        expect(state, "window.h.state (editor test hook) is not exposed");
        expectEqual(
          page.__pageErrors.length,
          0,
          `page errors: ${page.__pageErrors.join(" | ")}`,
        );
      },
      { evidence: { page, selectors: [".excalidraw"] } },
    );

    await runner.check(
      "baseline.draw-rectangle",
      "toolbar click + canvas drag creates a rectangle",
      async () => {
        await resetEditor(page);
        await drawRectangle(page);
        const els = await elements(page);
        expectEqual(els.length, 1, "element count");
        expectEqual(els[0].type, "rectangle", "element type");
      },
      { evidence: { page, selectors: ['[data-testid="toolbar-rectangle"]'] } },
    );

    await runner.check(
      "baseline.drag-captures-pointer",
      "a drag crossing the toolbar keeps tracking and never lights it up",
      async () => {
        await resetEditor(page);
        await drawRectangle(page);
        // deselect, so the drag below grabs the shape by its stroke rather
        // than landing on one of the selection's transform handles
        await page.mouse.click(1150, 780);
        await waitFor(
          page,
          () => Object.keys(window.h.state.selectedElementIds).length === 0,
          { message: "clicking empty canvas did not deselect" },
        );
        const before = await elementBox(page);

        // the icon inside a toolbar button: an `<svg>`, so an uncaptured
        // drag passing over it reports a target that is no `HTMLElement`
        const icon = await rectOf(page, TOOLBAR_ICON);
        expect(icon, `${TOOLBAR_ICON} is not rendered`);
        await expectOwnsPixels(page, TOOLBAR_ICON, "toolbar icon");
        const over = [
          icon.x + Math.round(icon.width / 2),
          icon.y + Math.round(icon.height / 2),
        ];

        const from = [550, 400]; // on the rectangle's top edge, off its corners
        await page.mouse.move(from[0], from[1]);
        await page.mouse.down();
        try {
          await page.mouse.move(over[0], over[1], { steps: 16 });
          const held = await elementBox(page);
          expectEqual(
            `${held.x},${held.y}`,
            `${before.x + (over[0] - from[0])},${
              before.y + (over[1] - from[1])
            }`,
            "the dragged shape stopped tracking the pointer over the toolbar",
          );
          // the captured pointer never reaches the toolbar: nothing under it
          // takes hover, and the capture target keeps it instead
          const hover = await page.evaluate(() => ({
            toolbar: !!document.querySelector(".App-toolbar :hover"),
            deepest: window.__e2e.describe(
              [...document.querySelectorAll(":hover")].at(-1),
            ),
          }));
          expect(
            !hover.toolbar,
            `the toolbar took hover mid-drag (deepest :hover ${hover.deepest})`,
          );
          expectEqual(
            hover.deepest,
            "canvas.excalidraw__canvas.interactive",
            "the deepest hovered node mid-drag",
          );
        } finally {
          await page.mouse.move(900, 700, { steps: 8 });
          await page.mouse.up();
        }

        const after = await elementBox(page);
        expectEqual(
          `${after.x},${after.y}`,
          `${before.x + (900 - from[0])},${before.y + (700 - from[1])}`,
          "the released shape's position",
        );
        const els = await elements(page);
        expectEqual(els.length, 1, "element count after the drag");
        expectEqual(
          (await appState(page)).activeTool,
          "selection",
          "the tool the drag ended on",
        );
      },
      {
        evidence: {
          page,
          selectors: [TOOLBAR_ICON, "canvas.excalidraw__canvas.interactive"],
        },
      },
    );

    await runner.check(
      "baseline.select-shows-properties",
      "clicking a shape selects it and opens the properties panel",
      async () => {
        await resetEditor(page);
        await drawRectangle(page);
        // deselect first, so the selection under test is the click's own doing
        await page.mouse.click(1150, 780);
        await waitFor(
          page,
          () => Object.keys(window.h.state.selectedElementIds).length === 0,
          {
            message: "clicking empty canvas did not deselect",
          },
        );
        expect(
          !(await rectOf(page, ".App-menu__left")),
          "properties panel still mounted while nothing is selected",
        );
        // transparent-background shapes are only hit-testable on their stroke
        await page.mouse.click(600, 400);
        await waitFor(
          page,
          () => Object.keys(window.h.state.selectedElementIds).length === 1,
          {
            message: "clicking the shape's stroke did not select it",
          },
        );
        await waitFor(page, () => !!document.querySelector(".App-menu__left"), {
          message: "properties panel did not appear for the selection",
        });
        const panel = await rectOf(page, ".App-menu__left");
        expect(
          panel.width > 0 && panel.height > 0,
          `properties panel has no size: ${JSON.stringify(panel)}`,
        );
        await expectOwnsPixels(page, ".App-menu__left", "properties panel");
      },
      { evidence: { page, selectors: [".App-menu__left"] } },
    );

    await runner.check(
      "baseline.shape-switch-popup",
      "Tab opens the shape-switch popup over the selection and converts the element",
      async () => {
        await resetEditor(page);
        await drawRectangle(page);
        await waitFor(
          page,
          () => Object.keys(window.h.state.selectedElementIds).length === 1,
          { message: "the drawn rectangle was not left selected" },
        );
        // the first Tab only opens the panel — it must not convert anything
        await page.keyboard.press("Tab");
        await waitFor(
          page,
          () => !!document.querySelector(".ConvertElementTypePopup"),
          { message: "Tab did not open the shape-switch popup" },
        );
        await expectOwnsPixels(
          page,
          ".ConvertElementTypePopup",
          "shape switch popup",
        );
        expectEqual(
          (await elements(page))[0].type,
          "rectangle",
          "element type after the popup opened",
        );
        await page.keyboard.press("Tab");
        await waitFor(
          page,
          () => window.__e2e.elements()[0].type === "diamond",
          { message: "a second Tab did not cycle the rectangle to a diamond" },
        );
        await clickCenter(
          page,
          '.ConvertElementTypePopup [data-testid="toolbar-ellipse"]',
        );
        await waitFor(
          page,
          () => window.__e2e.elements()[0].type === "ellipse",
          {
            message: "clicking the popup's ellipse did not convert the element",
          },
        );
      },
      {
        evidence: {
          page,
          selectors: [
            ".ConvertElementTypePopup",
            '.ConvertElementTypePopup [data-testid="toolbar-ellipse"]',
          ],
        },
      },
    );

    await runner.check(
      "baseline.hamburger-menu-items",
      "every hamburger menu item and region is present, enabled and clickable",
      async () => {
        await resetEditor(page);
        await openMainMenu(page);
        const found = await page.evaluate(
          (ids) =>
            ids.map((id) => {
              const el = document.querySelector(`[data-testid="${id}"]`);
              return { id, present: !!el, disabled: el ? !!el.disabled : null };
            }),
          MAIN_MENU_ITEMS,
        );
        const missing = found.filter((f) => !f.present).map((f) => f.id);
        expect(
          missing.length === 0,
          `menu items missing: ${missing.join(", ")}`,
        );
        const disabled = found.filter((f) => f.disabled).map((f) => f.id);
        expect(
          disabled.length === 0,
          `menu items disabled: ${disabled.join(", ")}`,
        );
        for (const id of MAIN_MENU_ITEMS) {
          await expectOwnsPixels(page, `[data-testid="${id}"]`, "menu item");
        }
        // the regions below the action items: socials, theme, language, canvas bg
        const counts = await page.evaluate(
          (regions) =>
            regions.map((region) => ({
              ...region,
              actual: document.querySelectorAll(region.selector).length,
            })),
          MAIN_MENU_REGIONS,
        );
        const wrong = counts.filter((c) => c.actual !== c.count);
        expect(
          wrong.length === 0,
          `menu regions wrong: ${wrong
            .map((c) => `${c.name} rendered ${c.actual}/${c.count}`)
            .join("; ")}`,
        );
        for (const region of MAIN_MENU_REGIONS) {
          if (region.name === "separators") {
            continue; // decorative, nothing to click
          }
          await expectOwnsPixels(page, region.selector, region.name);
        }
        // and the sample item actually does its job
        await clickCenter(page, '[data-testid="help-menu-item"]');
        await waitFor(page, () => window.h.state.openDialog?.name === "help", {
          message: "clicking Help did not open the help dialog",
        });
      },
      {
        evidence: {
          page,
          selectors: [
            '[data-testid="dropdown-menu"]',
            ".dropdown-menu-container",
          ],
        },
      },
    );

    await runner.check(
      "baseline.visual-debug-toggle",
      "the dev-only Visual Debug item mounts, paints and unmounts the debug canvas",
      async () => {
        await resetEditor(page);
        await openMainMenu(page);
        await expectOwnsPixels(page, VISUAL_DEBUG_ITEM, "Visual Debug item");
        expectEqual(
          await page.evaluate(
            (sel) => document.querySelector(sel).textContent.trim(),
            VISUAL_DEBUG_ITEM,
          ),
          "Visual Debug",
          "the Visual Debug item's label",
        );
        expectEqual(
          await page.evaluate(() => !!window.visualDebug),
          false,
          "window.visualDebug before the toggle",
        );

        await clickAndExpect(
          page,
          VISUAL_DEBUG_ITEM,
          (sel) => !!window.visualDebug && !!document.querySelector(sel),
          {
            args: [DEBUG_CANVAS],
            message: "toggling Visual Debug did not mount the debug canvas",
          },
        );

        // the overlay is sized off appState at the device pixel ratio, and
        // must not eat pointer events on its way over the scene
        const overlay = await page.evaluate((sel) => {
          const canvas = document.querySelector(sel);
          const style = getComputedStyle(canvas);
          return {
            width: canvas.width,
            height: canvas.height,
            cssWidth: style.width,
            cssHeight: style.height,
            position: style.position,
            pointerEvents: style.pointerEvents,
            expectedWidth: window.h.state.width * window.devicePixelRatio,
            expectedHeight: window.h.state.height * window.devicePixelRatio,
            expectedCssWidth: `${window.h.state.width}px`,
            expectedCssHeight: `${window.h.state.height}px`,
          };
        }, DEBUG_CANVAS);
        expectEqual(
          overlay.width,
          overlay.expectedWidth,
          "debug canvas backing-store width",
        );
        expectEqual(
          overlay.height,
          overlay.expectedHeight,
          "debug canvas backing-store height",
        );
        expectEqual(
          overlay.cssWidth,
          overlay.expectedCssWidth,
          "debug canvas CSS width",
        );
        expectEqual(
          overlay.cssHeight,
          overlay.expectedCssHeight,
          "debug canvas CSS height",
        );
        expectEqual(overlay.position, "absolute", "debug canvas position");
        expectEqual(
          overlay.pointerEvents,
          "none",
          "debug canvas pointerEvents",
        );

        // the frame stepper the visual debugger puts in the footer
        expect(
          await page.evaluate(
            (sel) => !!document.querySelector(sel),
            DEBUG_STEP_FORWARD,
          ),
          "the debug footer's frame stepper did not mount",
        );

        // a primitive shaped exactly as `@excalidraw/element/visualdebug`'s
        // producers push them must reach the overlay's pixels; the sample box
        // is empty until it does
        expectEqual(
          await page.evaluate(paintedDebugPixels, DEBUG_CANVAS),
          0,
          "painted pixels in the sample box before anything was pushed",
        );
        await page.evaluate(() => {
          const { scrollX, scrollY, zoom } = window.h.state;
          const toScene = (x, y) => [
            x / zoom.value - scrollX,
            y / zoom.value - scrollY,
          ];
          window.visualDebug.data = [
            [
              {
                color: "#ff0000",
                permanent: true,
                data: [toScene(280, 300), toScene(320, 300)],
              },
              {
                color: "#ff0000",
                permanent: true,
                data: [toScene(300, 280), toScene(300, 320)],
              },
            ],
          ];
        });
        // the stepper's own repaint, which is what upstream's
        // `<AppFooter onChange>` exists to trigger
        await clickCenter(page, DEBUG_STEP_FORWARD);
        await waitForDebugPaint(page);

        await openMainMenu(page);
        await clickAndExpect(
          page,
          VISUAL_DEBUG_ITEM,
          (sel) => !window.visualDebug && !document.querySelector(sel),
          {
            args: [DEBUG_CANVAS],
            message: "toggling Visual Debug off did not unmount the canvas",
          },
        );
        expectEqual(
          await page.evaluate(
            (sel) => !!document.querySelector(sel),
            DEBUG_STEP_FORWARD,
          ),
          false,
          "the debug footer's frame stepper survived the toggle",
        );
        expectEqual(
          await page.evaluate(() => localStorage.getItem("excalidraw-debug")),
          JSON.stringify({ enabled: false }),
          "the persisted debug state",
        );
      },
      {
        evidence: {
          page,
          selectors: [VISUAL_DEBUG_ITEM, DEBUG_CANVAS],
        },
      },
    );

    // ------------------------------------------------------- styles panel
    runner.group("styles panel");

    await runner.check(
      "styles.align-left",
      "Align left in the styles panel equalizes the selection's x",
      async () => {
        await resetEditor(page);
        await drawRectangle(page, [400, 300], [500, 400]);
        await clickCenter(page, '[data-testid="toolbar-rectangle"]');
        await dragCanvas(page, [700, 500], [800, 600]);
        await waitFor(page, () => window.__e2e.elements().length === 2, {
          message: "the second rectangle was not created",
        });

        await pressWithMod(page, "a");
        await waitFor(
          page,
          () => Object.keys(window.h.state.selectedElementIds).length === 2,
          { message: "select-all did not select both rectangles" },
        );

        await waitFor(page, (sel) => !!document.querySelector(sel), {
          args: [ALIGN_LEFT_BUTTON],
          message: "the styles panel rendered no Align left button",
        });

        const before = await elementPositions(page);
        expect(
          before[0].x !== before[1].x,
          "the two rectangles already shared an x before aligning",
        );
        const leftmost = Math.min(before[0].x, before[1].x);

        await clickCenter(page, ALIGN_LEFT_BUTTON);
        await waitFor(
          page,
          () => {
            const els = (window.h?.elements ?? []).filter(
              (el) => !el.isDeleted,
            );
            return els.length === 2 && els[0].x === els[1].x;
          },
          { message: "clicking Align left did not equalize x" },
        );

        const after = await elementPositions(page);
        expectEqual(after[0].x, leftmost, "the first rectangle's x");
        expectEqual(after[1].x, leftmost, "the second rectangle's x");
        // the perpendicular axis is untouched
        expectEqual(
          `${after[0].y},${after[1].y}`,
          `${before[0].y},${before[1].y}`,
          "the y coordinates after aligning",
        );
      },
      { evidence: { page, selectors: [ALIGN_LEFT_BUTTON] } },
    );
  });

  // ------------------------------------------------------- menu preferences
  await withPage("preferences", async (page) => {
    runner.group("main menu preferences submenu");

    const openPreferences = async () => {
      await openMainMenu(page);
      await clickCenter(page, '[data-testid="preferences-menu-item"]');
      await waitFor(
        page,
        () => !!document.querySelector('[data-testid="dropdown-submenu"]'),
        { message: "the Preferences submenu did not open" },
      );
    };

    await runner.check(
      "preferences.submenu-opens",
      "the Preferences submenu opens, is solid and lists upstream's full row set",
      async () => {
        await resetEditor(page);
        await openPreferences();
        await screenshot(page, "preferences-open");
        await expectOpaque(
          page,
          '[data-testid="dropdown-submenu"] .dropdown-menu-container',
          "preferences submenu",
        );
        await expectOwnsPixels(
          page,
          '[data-testid="dropdown-submenu"] .dropdown-menu-container',
          "preferences submenu",
        );
        const found = await page.evaluate(
          (rows) =>
            rows.map(({ testid }) => {
              const el = document.querySelector(
                `[data-testid="dropdown-submenu"] [data-testid="${testid}"]`,
              );
              return {
                testid,
                present: !!el,
                label:
                  el
                    ?.querySelector(".dropdown-menu-item__text")
                    ?.textContent.trim() ?? "",
                shortcut:
                  el
                    ?.querySelector(".dropdown-menu-item__shortcut")
                    ?.textContent.trim() ?? "",
              };
            }),
          PREFERENCES_ITEMS,
        );
        const missing = found.filter((f) => !f.present).map((f) => f.testid);
        expect(
          missing.length === 0,
          `preferences rows missing: ${missing.join(", ")}`,
        );
        expect(
          found.every((f) => f.label.length > 0),
          "a preferences row rendered without a label",
        );
        PREFERENCES_ITEMS.forEach((expected, index) => {
          const actual = found[index];
          if (expected.shortcut === null) {
            expect(
              actual.shortcut.length > 0,
              `${expected.testid} rendered no shortcut`,
            );
            return;
          }
          expectEqual(
            actual.shortcut,
            expected.shortcut,
            `${expected.testid} shortcut`,
          );
        });
        // the box-selection radio upstream renders above the toggles
        const radios = await page.evaluate(
          () =>
            document.querySelectorAll(
              '[data-testid="dropdown-submenu"] .RadioGroup__choice',
            ).length,
        );
        expectEqual(radios, 2, "box-selection radio choices");
        for (const { testid } of PREFERENCES_ITEMS) {
          await expectOwnsPixels(
            page,
            `[data-testid="dropdown-submenu"] [data-testid="${testid}"]`,
            "preferences row",
          );
        }
      },
      {
        evidence: {
          page,
          selectors: [
            '[data-testid="dropdown-submenu"]',
            '[data-testid="preferences-menu-item"]',
          ],
        },
      },
    );

    await runner.check(
      "preferences.box-selection-radio",
      "the box-selection radio writes appState and keeps the submenu open",
      async () => {
        await resetEditor(page);
        await openPreferences();
        await clickAndExpect(
          page,
          '[data-testid="dropdown-submenu"] .RadioGroup__choice:last-child',
          () => window.h.state.boxSelectionMode === "overlap",
          {
            message: "picking `Overlap` did not set appState.boxSelectionMode",
          },
        );
        expect(
          await page.evaluate(
            () => !!document.querySelector('[data-testid="dropdown-submenu"]'),
          ),
          "changing the box-selection mode closed the submenu",
        );
      },
      {
        evidence: {
          page,
          selectors: ['[data-testid="dropdown-submenu"] .RadioGroup__choice'],
        },
      },
    );

    await runner.check(
      "preferences.toggle-persists-across-reload",
      "toggling grid mode keeps the menu open, checks the row and survives a reload",
      async () => {
        await resetEditor(page);
        await openPreferences();
        await clickAndExpect(
          page,
          '[data-testid="dropdown-submenu"] [data-testid="preferences-grid-mode"]',
          () => window.h.state.gridModeEnabled === true,
          {
            message:
              "the grid-mode row did not toggle appState.gridModeEnabled",
          },
        );
        expect(
          await page.evaluate(
            () => !!document.querySelector('[data-testid="dropdown-submenu"]'),
          ),
          "toggling a preference closed the submenu (upstream preventDefaults it)",
        );
        await waitFor(
          page,
          () =>
            document
              .querySelector(
                '[data-testid="dropdown-submenu"] [data-testid="preferences-grid-mode"] .dropdown-menu-item__icon svg',
              )
              ?.querySelector("polyline") != null,
          { message: "the toggled row did not switch to the check icon" },
        );
        await waitFor(
          page,
          () =>
            JSON.parse(localStorage.getItem("excalidraw-state") ?? "{}")
              .gridModeEnabled === true,
          { message: "the toggled preference never reached localStorage" },
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitFor(page, () => window.h?.state?.gridModeEnabled === true, {
          message: "the toggled preference did not survive a reload",
          timeout: 20000,
        });
      },
      {
        evidence: {
          page,
          selectors: [
            '[data-testid="dropdown-submenu"] [data-testid="preferences-grid-mode"]',
          ],
        },
      },
    );

    await runner.check(
      "preferences.escape-closes-submenu-only",
      "Escape closes the submenu and leaves the menu around it open",
      async () => {
        await resetEditor(page);
        await openPreferences();
        await page.keyboard.press("Escape");
        await waitFor(
          page,
          () => !document.querySelector('[data-testid="dropdown-submenu"]'),
          { message: "Escape did not close the Preferences submenu" },
        );
        expect(
          await page.evaluate(
            () => !!document.querySelector('[data-testid="dropdown-menu"]'),
          ),
          "Escape closed the whole main menu, not just the submenu",
        );
      },
      {
        evidence: {
          page,
          selectors: ['[data-testid="dropdown-submenu"]'],
        },
      },
    );

    await runner.check(
      "preferences.save-to-active-file-is-conditional",
      "`Save to current file` renders only once the scene has a file handle",
      async () => {
        await resetEditor(page);
        await openMainMenu(page);
        expect(
          await page.evaluate(
            (id) => !document.querySelector(`[data-testid="${id}"]`),
            SAVE_TO_ACTIVE_FILE_ITEM,
          ),
          "`Save to current file` renders with no active file handle; upstream gates it on `appState.fileHandle`",
        );
        await page.evaluate(() =>
          window.h.setState({ fileHandle: { name: "scene.excalidraw" } }),
        );
        await waitFor(
          page,
          (id) => {
            const el = document.querySelector(`[data-testid="${id}"]`);
            return !!el && !el.disabled;
          },
          {
            message:
              "`Save to current file` did not appear once a file handle was set",
            args: [SAVE_TO_ACTIVE_FILE_ITEM],
          },
        );
        await expectOwnsPixels(
          page,
          `[data-testid="${SAVE_TO_ACTIVE_FILE_ITEM}"]`,
          "save to current file",
        );
        await page.evaluate(() => window.h.setState({ fileHandle: null }));
      },
      {
        evidence: {
          page,
          selectors: [`[data-testid="${SAVE_TO_ACTIVE_FILE_ITEM}"]`],
        },
      },
    );
  });

  // ------------------------------------------------------------- help dialog
  await withPage("help", async (page) => {
    runner.group("help dialog");

    await runner.check(
      "help.opens-from-menu",
      "help dialog opens from the hamburger menu and is visible",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        const content = await rectOf(page, ".HelpDialog .Modal__content");
        expect(
          content && content.width > 400 && content.height > 300,
          `help dialog has no usable size: ${JSON.stringify(content)}`,
        );
        await expectOpaque(page, ".HelpDialog .Modal__content", "help dialog");
      },
      { evidence: { page, selectors: [".HelpDialog .Modal__content"] } },
    );

    await runner.check(
      "help.owns-its-pixels",
      "help dialog is the topmost thing where it is drawn",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        await screenshot(page, "help-open");
        await expectOwnsPixels(
          page,
          ".HelpDialog .Modal__content",
          "help dialog",
        );
      },
      {
        evidence: {
          page,
          selectors: [
            ".HelpDialog .Modal__content",
            ".HelpDialog .Modal__background",
          ],
        },
      },
    );

    await runner.check(
      "help.close-via-escape",
      "Escape closes the help dialog",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        await page.keyboard.press("Escape");
        await waitFor(
          page,
          () => !document.querySelector(".Modal.HelpDialog"),
          {
            message: "Escape did not close the help dialog",
          },
        );
      },
      { evidence: { page, selectors: [".Modal.HelpDialog"] } },
    );

    await runner.check(
      "help.close-via-escape-after-click",
      "Escape still closes after the user clicks inside the dialog",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        await clickCenter(page, ".HelpDialog .Modal__content");
        await page.keyboard.press("Escape");
        await waitFor(
          page,
          () => !document.querySelector(".Modal.HelpDialog"),
          {
            message: `Escape did not close the help dialog after a click inside it (focus moved to ${await page.evaluate(
              () => window.__e2e.describe(document.activeElement),
            )})`,
          },
        );
      },
      { evidence: { page, selectors: [".HelpDialog .Modal__content"] } },
    );

    await runner.check(
      "help.close-via-button",
      "the desktop dialog renders no close button — Escape and the backdrop are its affordances",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        const closeBtn = await rectOf(page, ".HelpDialog .Dialog__close");
        expect(
          !closeBtn,
          ".HelpDialog renders a `.Dialog__close`; upstream `Dialog.tsx` " +
            "renders one only at phone form factor",
        );
        expect(
          await rectOf(page, ".HelpDialog .Modal__background"),
          ".HelpDialog has no `.Modal__background` to dismiss it with",
        );
        expect(
          await page.evaluate(() =>
            document
              .querySelector(".Modal.HelpDialog")
              ?.contains(document.activeElement),
          ),
          `focus sits outside the dialog, so Escape cannot reach it (${await page.evaluate(
            () => window.__e2e.describe(document.activeElement),
          )})`,
        );
      },
      {
        evidence: {
          page,
          selectors: [
            ".Modal.HelpDialog",
            ".HelpDialog .Dialog__close",
            ".HelpDialog .Modal__background",
          ],
        },
      },
    );

    await runner.check(
      "help.close-via-backdrop",
      "clicking the backdrop closes the help dialog",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        const content = await rectOf(page, ".HelpDialog .Modal__content");
        const x = Math.max(8, Math.round(content.x / 2));
        await page.mouse.click(x, Math.round(VIEWPORT.height / 2));
        await waitFor(
          page,
          () => !document.querySelector(".Modal.HelpDialog"),
          {
            message: `clicking the backdrop at x=${x} did not close the help dialog`,
          },
        );
      },
      { evidence: { page, selectors: [".HelpDialog .Modal__background"] } },
    );
  });

  // --------------------------------------------------------- command palette
  await withPage("palette", async (page) => {
    runner.group("command palette");

    const openPalette = async () => {
      await page.mouse.click(720, 620);
      await pressWithMod(page, "/");
      await waitFor(
        page,
        () => !!document.querySelector(".Modal.command-palette-dialog"),
        {
          message: "Cmd+/ did not open the command palette",
        },
      );
      await waitFor(
        page,
        () => !!document.querySelector(".command-palette-dialog input"),
        {
          message: "command palette has no search input",
        },
      );
      await waitForAnimations(page, ".command-palette-dialog .Modal__content");
    };

    await runner.check(
      "palette.opens-via-shortcut",
      "Cmd+/ opens the command palette",
      async () => {
        await resetEditor(page);
        await openPalette();
        const state = await appState(page);
        expectEqual(state.openDialog, "commandPalette", "openDialog");
      },
      { evidence: { page, selectors: [".Modal.command-palette-dialog"] } },
    );

    await runner.check(
      "palette.opens-via-menu-item",
      "the menu item opens the command palette",
      async () => {
        await resetEditor(page);
        await openMainMenu(page);
        await clickCenter(page, '[data-testid="command-palette-button"]');
        await waitFor(
          page,
          () => window.h.state.openDialog?.name === "commandPalette",
          {
            message: "the Command palette menu item did not open it",
          },
        );
      },
      {
        evidence: {
          page,
          selectors: ['[data-testid="command-palette-button"]'],
        },
      },
    );

    await runner.check(
      "palette.solid-background",
      "the palette island is solid — nothing shows through it",
      async () => {
        await resetEditor(page);
        await openPalette();
        await screenshot(page, "palette-open");
        await expectOpaque(
          page,
          ".command-palette-dialog .Island",
          "command palette island",
        );
        await expectOwnsPixels(
          page,
          ".command-palette-dialog .Island",
          "command palette island",
        );
      },
      {
        evidence: {
          page,
          selectors: [
            ".command-palette-dialog .Island",
            ".command-palette-dialog .Modal__content",
          ],
        },
      },
    );

    await runner.check(
      "palette.filters-on-typing",
      "typing a query filters the command list",
      async () => {
        await resetEditor(page);
        await openPalette();
        const before = await page.evaluate(
          () =>
            document.querySelectorAll(".command-palette-dialog .command-item")
              .length,
        );
        expect(before > 0, "the palette listed no commands before typing");
        await page.keyboard.type("rectangle");
        await waitFor(
          page,
          () =>
            document.querySelector(".command-palette-dialog input")?.value ===
            "rectangle",
          { message: "typing did not reach the palette's search input" },
        );
        await waitFor(
          page,
          (n) => {
            const items = [
              ...document.querySelectorAll(
                ".command-palette-dialog .command-item",
              ),
            ];
            return items.length > 0 && items.length < n;
          },
          {
            message: `the command list did not narrow from ${before} results`,
            args: [before],
          },
        );
        const first = await page.evaluate(() =>
          document
            .querySelector(".command-palette-dialog .command-item")
            ?.textContent?.trim(),
        );
        expect(
          /rectangle/i.test(first ?? ""),
          `first result is ${JSON.stringify(
            first,
          )}, expected a Rectangle command`,
        );
      },
      { evidence: { page, selectors: [".command-palette-dialog input"] } },
    );

    await runner.check(
      "palette.escape-closes",
      "Escape closes the command palette",
      async () => {
        await resetEditor(page);
        await openPalette();
        await page.keyboard.type("rect");
        await page.keyboard.press("Escape");
        await waitFor(
          page,
          () => !document.querySelector(".Modal.command-palette-dialog"),
          {
            message: "Escape did not close the command palette",
          },
        );
      },
      { evidence: { page, selectors: [".Modal.command-palette-dialog"] } },
    );

    await runner.check(
      "palette.item-clickable",
      "clicking a palette command runs it",
      async () => {
        await resetEditor(page);
        await openPalette();
        await page.keyboard.type("rectangle");
        await waitFor(
          page,
          () => {
            const first = document.querySelector(
              ".command-palette-dialog .command-item",
            );
            return !!first && /rectangle/i.test(first.textContent ?? "");
          },
          { message: "no Rectangle command to click" },
        );
        await clickAndExpect(
          page,
          ".command-palette-dialog .command-item",
          () => window.h.state.activeTool.type === "rectangle",
          { message: "clicking the Rectangle command did not switch tools" },
        );
      },
      {
        evidence: {
          page,
          selectors: [".command-palette-dialog .command-item"],
        },
      },
    );
  });

  // ------------------------------------------------------------- dialog UIs
  await withPage("dialogs", async (page) => {
    runner.group("dialog controls");

    await runner.check(
      "dialog.image-export-toggle-clickable",
      "the image-export background switch responds to a click",
      async () => {
        await resetEditor(page);
        await drawRectangle(page);
        await openMainMenu(page);
        await clickCenter(page, '[data-testid="image-export-button"]');
        await waitFor(
          page,
          () => !!document.querySelector("#exportBackgroundSwitch"),
          {
            message: "image-export dialog did not mount",
          },
        );
        const before = (await appState(page)).exportBackground;
        await clickAndExpect(
          page,
          "#exportBackgroundSwitch",
          (v) => window.h.state.exportBackground !== v,
          {
            message: `clicking the 'with background' switch left appState.exportBackground at ${before}`,
            args: [before],
          },
        );
      },
      {
        evidence: {
          page,
          selectors: ["#exportBackgroundSwitch", ".ImageExportModal"],
        },
      },
    );

    await runner.check(
      "dialog.confirm-buttons-clickable",
      "the clear-canvas confirm dialog's buttons respond",
      async () => {
        await resetEditor(page);
        await drawRectangle(page);
        await openMainMenu(page);
        await clickCenter(page, '[data-testid="clear-canvas-button"]');
        await waitFor(
          page,
          () => !!document.querySelector(".Modal.confirm-dialog"),
          {
            message: "clear-canvas confirm dialog did not mount",
          },
        );
        const buttons = await page.evaluate(() =>
          [...document.querySelectorAll(".confirm-dialog-buttons button")].map(
            (b) => b.textContent.trim(),
          ),
        );
        expectEqual(
          buttons.length,
          2,
          `confirm dialog buttons (${buttons.join("/")})`,
        );
        await clickAndExpect(
          page,
          ".confirm-dialog-buttons button",
          () => !document.querySelector(".Modal.confirm-dialog"),
          { message: "clicking Cancel did not dismiss the confirm dialog" },
        );
        const els = await elements(page);
        expectEqual(els.length, 1, "Cancel must keep the canvas contents");
      },
      {
        evidence: {
          page,
          selectors: [
            ".confirm-dialog-buttons button",
            ".Modal.confirm-dialog",
          ],
        },
      },
    );
  });

  // ------------------------------------------------------- extra-tools menu
  await withPage("extra-tools", async (page) => {
    runner.group("extra-tools dropdown");

    const dropdownOpen = () =>
      page.evaluate(
        () =>
          !!document.querySelector(
            ".App-toolbar__extra-tools-dropdown .dropdown-menu-container",
          ),
      );
    // the trigger toggles, and the open flag is component state that
    // `resetEditor` cannot reach — so normalise before opening
    const openExtraTools = async () => {
      if (await dropdownOpen()) {
        await clickCenter(page, ".App-toolbar__extra-tools-trigger");
        await waitFor(
          page,
          () =>
            !document.querySelector(
              ".App-toolbar__extra-tools-dropdown .dropdown-menu-container",
            ),
          { message: "extra-tools dropdown would not close" },
        );
      }
      await clickCenter(page, ".App-toolbar__extra-tools-trigger");
      await waitFor(
        page,
        () =>
          !!document.querySelector(
            ".App-toolbar__extra-tools-dropdown .dropdown-menu-container",
          ),
        { message: "extra-tools dropdown did not open" },
      );
    };

    await runner.check(
      "extraTools.dropdown-solid",
      "the extra-tools dropdown is solid and unobstructed",
      async () => {
        await resetEditor(page);
        await openExtraTools();
        await screenshot(page, "extra-tools-open");
        await expectOpaque(
          page,
          ".App-toolbar__extra-tools-dropdown .dropdown-menu-container",
          "extra-tools dropdown",
        );
        await expectOwnsPixels(
          page,
          ".App-toolbar__extra-tools-dropdown .dropdown-menu-container",
          "extra-tools dropdown",
        );
      },
      {
        evidence: {
          page,
          selectors: [
            ".App-toolbar__extra-tools-dropdown .dropdown-menu-container",
          ],
        },
      },
    );

    await runner.check(
      "extraTools.full-inventory",
      "the extra-tools dropdown lists upstream's full item set, in order, with its shortcuts",
      async () => {
        await resetEditor(page);
        await openExtraTools();
        const items = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              ".App-toolbar__extra-tools-dropdown .dropdown-menu-item",
            ),
          ].map((b) => ({
            testid: b.dataset.testid,
            label:
              b
                .querySelector(".dropdown-menu-item__text")
                ?.textContent.trim() ?? "",
            shortcut:
              b
                .querySelector(".dropdown-menu-item__shortcut")
                ?.textContent.trim() ?? "",
            disabled: !!b.disabled,
          })),
        );
        expectEqual(
          items.map((i) => i.label).join(" | "),
          EXTRA_TOOLS_ITEMS.map((i) => i.label).join(" | "),
          "extra-tools items (labels, in order)",
        );
        expectEqual(
          items.map((i) => i.testid).join(" | "),
          EXTRA_TOOLS_ITEMS.map((i) => i.testid).join(" | "),
          "extra-tools items (testids, in order)",
        );
        EXTRA_TOOLS_ITEMS.forEach((expected, index) => {
          const actual = items[index];
          if (expected.shortcut === null) {
            expect(
              actual.shortcut.length > 0,
              `${expected.label} rendered no shortcut`,
            );
            return;
          }
          expectEqual(
            actual.shortcut,
            expected.shortcut,
            `${expected.label} shortcut`,
          );
        });
        expect(
          items.every((i) => !i.disabled),
          `extra-tools items disabled: ${items
            .filter((i) => i.disabled)
            .map((i) => i.label)
            .join(", ")}`,
        );
        // the "Generate" heading upstream renders above the mermaid entry
        expect(
          await page.evaluate(() =>
            [
              ...document.querySelectorAll(
                ".App-toolbar__extra-tools-dropdown .dropdown-menu-container > div",
              ),
            ].some((d) => d.textContent.trim() === "Generate"),
          ),
          "the extra-tools dropdown has no `Generate` section heading",
        );
      },
      {
        evidence: {
          page,
          selectors: [
            ".App-toolbar__extra-tools-dropdown .dropdown-menu-container",
          ],
        },
      },
    );

    await runner.check(
      "extraTools.trigger-reflects-selection",
      "choosing an extra tool marks the trigger and the item as selected",
      async () => {
        await resetEditor(page);
        await openExtraTools();
        await clickAndExpect(
          page,
          '.App-toolbar__extra-tools-dropdown [data-testid="toolbar-laser"]',
          () => window.h.state.activeTool.type === "laser",
          {
            message:
              "choosing the laser tool from the dropdown did not activate it",
          },
        );
        await waitFor(
          page,
          () =>
            !document.querySelector(
              ".App-toolbar__extra-tools-dropdown .dropdown-menu-container",
            ),
          { message: "choosing a tool did not close the extra-tools dropdown" },
        );
        await waitFor(
          page,
          () =>
            !!document.querySelector(
              ".App-toolbar__extra-tools-trigger--selected",
            ),
          {
            message:
              "the extra-tools trigger is not marked selected while an extra tool is active",
          },
        );
        await openExtraTools();
        await waitFor(
          page,
          () =>
            !!document.querySelector(
              '.App-toolbar__extra-tools-dropdown [data-testid="toolbar-laser"].dropdown-menu-item--selected',
            ),
          { message: "the active extra-tools item is not marked selected" },
        );
      },
      {
        evidence: {
          page,
          selectors: [".App-toolbar__extra-tools-trigger"],
        },
      },
    );

    await runner.check(
      "extraTools.items-clickable",
      "extra-tools items are visible and selecting one switches the tool",
      async () => {
        await resetEditor(page);
        await openExtraTools();
        const items = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              ".App-toolbar__extra-tools-dropdown .dropdown-menu-item",
            ),
          ].map((b) => ({
            testid: b.dataset.testid,
            label: b.textContent.trim(),
            disabled: !!b.disabled,
          })),
        );
        expect(
          items.length >= 5,
          `extra-tools listed only ${items.length} items`,
        );
        expect(
          items.every((i) => i.label.length > 0),
          "an extra-tools item rendered without a label",
        );
        await clickAndExpect(
          page,
          '.App-toolbar__extra-tools-dropdown [data-testid="toolbar-frame"]',
          () => window.h.state.activeTool.type === "frame",
          {
            message:
              "choosing the frame tool from the dropdown did not activate it",
          },
        );
      },
      {
        evidence: {
          page,
          selectors: [
            '.App-toolbar__extra-tools-dropdown [data-testid="toolbar-frame"]',
          ],
        },
      },
    );
  });

  // ------------------------------------------------------------ links/branding
  await withPage("links", async (page) => {
    runner.group("menu links and branding");

    await runner.check(
      "links.socials-render",
      "the socials region renders labelled, well-formed external links",
      async () => {
        await resetEditor(page);
        await openMainMenu(page);
        const links = await readMenuLinks(page);
        expectEqual(links.length, 1, "socials link count");
        for (const link of links) {
          expect(
            link.label.length > 0,
            `a socials link rendered with no visible label (href ${link.href})`,
          );
          expect(
            (link.ariaLabel ?? "").length > 0,
            `socials link ${JSON.stringify(link.label)} has no aria-label`,
          );
          expect(
            /^https:\/\//.test(link.href ?? ""),
            `socials link ${JSON.stringify(
              link.label,
            )} href is ${JSON.stringify(link.href)}, expected an https URL`,
          );
          expectEqual(
            link.target,
            "_blank",
            `socials link ${JSON.stringify(link.label)} target`,
          );
          expect(
            (link.rel ?? "").includes("noopener"),
            `socials link ${JSON.stringify(link.label)} rel is ${JSON.stringify(
              link.rel,
            )}, expected it to include noopener`,
          );
        }
        await expectOwnsPixels(
          page,
          ".dropdown-menu-container caliburn-menu-socials a",
          "socials link",
        );
      },
      {
        evidence: {
          page,
          selectors: [".dropdown-menu-container caliburn-menu-socials a"],
        },
      },
    );

    await runner.check(
      "links.socials-point-at-this-app",
      "menu links point at this app's properties, not upstream Excalidraw's",
      async () => {
        await resetEditor(page);
        await openMainMenu(page);
        const links = await readMenuLinks(page);
        expect(links.length > 0, "no socials links to inspect");
        const upstream = upstreamLinks(links);
        expect(
          upstream.length === 0,
          `links still pointing at upstream Excalidraw: ${upstream.join("; ")}`,
        );
      },
      {
        evidence: {
          page,
          selectors: [".dropdown-menu-container caliburn-menu-socials a"],
        },
      },
    );

    await runner.check(
      "links.menu-tail-renders",
      "the theme, language and canvas-background regions render and are usable",
      async () => {
        await resetEditor(page);
        await openMainMenu(page);
        const tail = await page.evaluate(() => ({
          themeChoices: document.querySelectorAll(
            ".dropdown-menu-container caliburn-menu-toggle-theme .RadioGroup__choice",
          ).length,
          themeActive: document.querySelectorAll(
            ".dropdown-menu-container caliburn-menu-toggle-theme .RadioGroup__choice.active",
          ).length,
          languageOptions:
            document.querySelector(
              ".dropdown-menu-container select.dropdown-select__language",
            )?.options.length ?? 0,
          canvasBackgroundLabel: !!document.querySelector(
            '.dropdown-menu-container [data-testid="canvas-background-label"]',
          ),
          topPicks: document.querySelectorAll(
            '.dropdown-menu-container [data-testid^="color-top-pick"]',
          ).length,
        }));
        expectEqual(tail.themeChoices, 3, "theme radio choices");
        expectEqual(tail.themeActive, 1, "theme choices marked active");
        expect(
          tail.languageOptions > 1,
          `language picker offers ${tail.languageOptions} options`,
        );
        expect(
          tail.canvasBackgroundLabel,
          "canvas background section has no label",
        );
        expectEqual(tail.topPicks, 5, "canvas background top picks");
        await expectOwnsPixels(
          page,
          ".dropdown-menu-container caliburn-menu-toggle-theme .RadioGroup__choice",
          "theme choice",
        );
        await expectOwnsPixels(
          page,
          ".dropdown-menu-container select.dropdown-select__language",
          "language picker",
        );
        await expectOwnsPixels(
          page,
          '.dropdown-menu-container [data-testid^="color-top-pick"]',
          "canvas background top pick",
        );
      },
      {
        evidence: {
          page,
          selectors: [
            ".dropdown-menu-container caliburn-menu-toggle-theme .RadioGroup__choice",
            ".dropdown-menu-container select.dropdown-select__language",
          ],
        },
      },
    );

    await runner.check(
      "links.language-relabels-in-place",
      "picking a language relabels the chrome in place, without rebuilding the editor",
      async () => {
        await resetEditor(page);
        await drawRectangle(page);

        // stamp the live nodes: a rebuilt subtree brings fresh DOM, which
        // carries no stamp, so identity is the honest remount detector
        await page.evaluate(() => {
          document.querySelector(
            "canvas.excalidraw__canvas.interactive",
          ).__e2eStamp = "before";
          document.querySelector(".excalidraw").__e2eStamp = "before";
        });
        const before = (await elements(page)).length;
        expect(before > 0, "no element on the canvas to survive the switch");

        await openMainMenu(page);
        expectEqual(
          await backgroundLabel(page),
          "Canvas background",
          "canvas background label before the switch",
        );

        await page.select(LANGUAGE_PICKER, "fr-FR");
        await waitFor(
          page,
          () =>
            document
              .querySelector('[data-testid="canvas-background-label"]')
              ?.textContent?.trim() === "Arrière-plan du canevas",
          { message: "the chrome did not relabel after the language change" },
        );

        const french = await page.evaluate(() => ({
          canvas: document.querySelector(
            "canvas.excalidraw__canvas.interactive",
          )?.__e2eStamp,
          editor: document.querySelector(".excalidraw")?.__e2eStamp,
          dir: document.documentElement.dir,
          lang: document.documentElement.lang,
        }));
        expectEqual(french.canvas, "before", "interactive canvas identity");
        expectEqual(french.editor, "before", "editor root identity");
        expectEqual(french.lang, "fr-FR", "document language");
        expectEqual(french.dir, "ltr", "writing direction of an LTR locale");
        expectEqual(
          (await elements(page)).length,
          before,
          "scene elements across the language change",
        );

        // an RTL locale flips the document's direction, still without a rebuild
        await page.select(LANGUAGE_PICKER, "ar-SA");
        await waitFor(page, () => document.documentElement.dir === "rtl", {
          message: "an RTL locale did not flip the writing direction",
        });
        expectEqual(
          await backgroundLabel(page),
          "خلفية اللوحة",
          "canvas background label in an RTL locale",
        );
        expectEqual(
          await page.evaluate(
            () =>
              document.querySelector("canvas.excalidraw__canvas.interactive")
                ?.__e2eStamp,
          ),
          "before",
          "interactive canvas identity across the RTL switch",
        );

        // back to English, so every later check reads its own labels
        await page.select(LANGUAGE_PICKER, "en");
        await waitFor(
          page,
          () =>
            document.documentElement.dir === "ltr" &&
            document
              .querySelector('[data-testid="canvas-background-label"]')
              ?.textContent?.trim() === "Canvas background",
          { message: "the chrome did not return to English" },
        );
      },
      {
        evidence: {
          page,
          selectors: [
            ".dropdown-menu-container select.dropdown-select__language",
            '[data-testid="canvas-background-label"]',
          ],
        },
      },
    );

    await runner.check(
      "links.help-dialog-no-upstream-links",
      "help dialog links point at this app's properties, not upstream Excalidraw's",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        const links = await readLinksIn(page, ".HelpDialog__header");
        expect(links.length > 0, "help dialog rendered no header links");
        const upstream = upstreamLinks(links);
        expect(
          upstream.length === 0,
          `help dialog links still pointing at upstream Excalidraw: ${upstream.join(
            "; ",
          )}`,
        );
      },
      { evidence: { page, selectors: [".HelpDialog__header"] } },
    );

    await runner.check(
      "links.welcome-screen-no-upstream-links",
      "the welcome screen renders with no links pointing at upstream Excalidraw",
      async () => {
        await resetEditor(page);
        const mounted = await rectOf(page, ".welcome-screen-center");
        expect(mounted, ".welcome-screen-center did not mount");
        const links = await readLinksIn(page, ".welcome-screen-center");
        const upstream = upstreamLinks(links);
        expect(
          upstream.length === 0,
          `welcome screen links still pointing at upstream Excalidraw: ${upstream.join(
            "; ",
          )}`,
        );
      },
      { evidence: { page, selectors: [".welcome-screen-center"] } },
    );
  });

  // ------------------------------------------------------------------ sidebar
  await withPage("sidebar", async (page) => {
    runner.group("library sidebar");

    const openSidebar = async () => {
      await clickCenter(page, ".sidebar-trigger__label-element");
      await waitFor(page, () => !!document.querySelector(".sidebar"), {
        message: "library sidebar did not open",
      });
    };

    await runner.check(
      "sidebar.no-layout-displacement",
      "opening the sidebar does not push the page content sideways",
      async () => {
        await resetEditor(page);
        const before = await rectOf(page, ".excalidraw");
        await openSidebar();
        await screenshot(page, "sidebar-open");
        const after = await rectOf(page, ".excalidraw");
        expectEqual(after.x, 0, "canvas container x with sidebar open");
        expectEqual(
          after.width,
          before.width,
          "canvas container width with sidebar open",
        );
        const root = await rectOf(page, "#root");
        expectEqual(root.x, 0, "#root x with sidebar open");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        expectEqual(
          overflow,
          VIEWPORT.width,
          "document scrollWidth (horizontal overflow)",
        );
      },
      { evidence: { page, selectors: [".excalidraw", ".sidebar"] } },
    );

    await runner.check(
      "sidebar.tab-triggers-present",
      "the sidebar's trigger row renders its tab buttons",
      async () => {
        await resetEditor(page);
        await openSidebar();
        const triggers = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              ".sidebar-triggers .sidebar-tab-trigger",
            ),
          ].map((b) => b.className),
        );
        expect(
          triggers.length >= 2,
          `sidebar trigger row has ${triggers.length} tab buttons, expected 2 (search + library)`,
        );
        await expectOwnsPixels(
          page,
          ".sidebar-triggers .sidebar-tab-trigger",
          "sidebar tab trigger",
        );
      },
      {
        evidence: {
          page,
          selectors: [".sidebar-triggers .sidebar-tab-trigger"],
        },
      },
    );

    await runner.check(
      "sidebar.close-restores-layout",
      "closing the sidebar restores the layout",
      async () => {
        await resetEditor(page);
        const before = await rectOf(page, ".excalidraw");
        await openSidebar();
        await clickCenter(page, ".sidebar__close");
        await waitFor(page, () => !document.querySelector(".sidebar"), {
          message: "the sidebar close button did not close it",
        });
        const after = await rectOf(page, ".excalidraw");
        expectEqual(after.x, before.x, "canvas container x after closing");
        expectEqual(
          after.width,
          before.width,
          "canvas container width after closing",
        );
        const layer = await rectOf(page, ".layer-ui__wrapper");
        expectEqual(layer.width, before.width, "UI layer width after closing");
      },
      { evidence: { page, selectors: [".excalidraw", ".layer-ui__wrapper"] } },
    );

    await runner.check(
      "sidebar.width-matches-upstream",
      "the sidebar is the upstream 302px column",
      async () => {
        await resetEditor(page);
        await openSidebar();
        const variable = await cssVar(
          page,
          ".excalidraw",
          "--right-sidebar-width",
        );
        expect(
          variable,
          "`--right-sidebar-width` is not set on the .excalidraw container",
        );
        expectEqual(variable, "302px", "--right-sidebar-width");
        const sidebar = await rectOf(page, ".sidebar");
        // Sidebar.scss: width: calc(var(--right-sidebar-width) - var(--space-factor) * 2)
        expectEqual(sidebar.width, 294, "sidebar width");
      },
      { evidence: { page, selectors: [".sidebar", ".excalidraw"] } },
    );

    await runner.check(
      "sidebar.docked-keeps-ui-layer",
      "docking the sidebar keeps the UI layer laid out",
      async () => {
        await resetEditor(page);
        await openSidebar();
        await clickCenter(page, ".sidebar__dock");
        await waitFor(
          page,
          () => window.h.state.defaultSidebarDockedPreference === true,
          {
            message: "the dock button did not dock the sidebar",
          },
        );
        const layer = await rectOf(page, ".layer-ui__wrapper");
        expect(
          layer.width > 0,
          `.layer-ui__wrapper collapsed to width ${
            layer.width
          } while docked (style width: ${await page.evaluate(
            () => document.querySelector(".layer-ui__wrapper").style.width,
          )})`,
        );
        expect(
          layer.width < VIEWPORT.width,
          `.layer-ui__wrapper did not reserve room for the docked sidebar (width ${layer.width})`,
        );
      },
      { evidence: { page, selectors: [".layer-ui__wrapper", ".sidebar"] } },
    );

    await runner.check(
      "sidebar.can-fit-sidebar-follows-width",
      "narrowing the editor past the sidebar breakpoint drops the dock button, widening restores it",
      async () => {
        await resetEditor(page);
        await openSidebar();
        expect(
          await page.evaluate(() => window.h.app.editorInterface.canFitSidebar),
          `canFitSidebar is false at ${VIEWPORT.width}px, above the 1229px breakpoint`,
        );
        expect(
          await rectOf(page, '.sidebar [data-testid="sidebar-dock"]'),
          "the dock button is missing while the editor is wide enough for it",
        );
        // MQ_RIGHT_SIDEBAR_MIN_WIDTH is 1229; 1100 is comfortably under it
        await page.setViewport({ width: 1100, height: VIEWPORT.height });
        await waitFor(
          page,
          () => window.h.app.editorInterface.canFitSidebar === false,
          {
            message:
              "narrowing the editor to 1100px did not recompute canFitSidebar",
          },
        );
        expect(
          !(await rectOf(page, '.sidebar [data-testid="sidebar-dock"]')),
          "the dock button still renders below the sidebar breakpoint",
        );
        await page.setViewport(VIEWPORT);
        await waitFor(
          page,
          () => window.h.app.editorInterface.canFitSidebar === true,
          {
            message: "widening the editor back did not recompute canFitSidebar",
          },
        );
        await waitFor(
          page,
          () =>
            !!document.querySelector('.sidebar [data-testid="sidebar-dock"]'),
          { message: "the dock button did not come back with the width" },
        );
      },
      {
        evidence: {
          page,
          selectors: ['.sidebar [data-testid="sidebar-dock"]', ".sidebar"],
        },
      },
    );
  });

  // -------------------------------------------------------------- space pan
  await withPage("pan", async (page) => {
    runner.group("canvas panning");

    await runner.check(
      "pan.space-hold-drag",
      "holding Space and dragging pans the canvas",
      async () => {
        await resetEditor(page);
        await page.mouse.click(720, 620);
        const before = await appState(page);
        await page.keyboard.down("Space");
        try {
          // below the welcome screen's centre menu: `resetEditor` empties the
          // scene, which brings the menu back, and its buttons own the pixels
          // around [700, 500] — a drag starting there never reaches the canvas
          await dragCanvas(page, [700, 650], [820, 770]);
        } finally {
          await page.keyboard.up("Space");
        }
        await waitFor(
          page,
          (x, y) =>
            window.h.state.scrollX !== x || window.h.state.scrollY !== y,
          {
            message: `space-hold drag left scroll at (${before.scrollX}, ${before.scrollY})`,
            args: [before.scrollX, before.scrollY],
            timeout: 3000,
          },
        );
        const els = await elements(page);
        expectEqual(els.length, 0, "a space-hold pan must not create elements");
      },
      {
        evidence: {
          page,
          selectors: ["canvas.excalidraw__canvas.interactive"],
        },
      },
    );
  });

  // ------------------------------------------------------- hover affordances
  await withPage("hover", async (page) => {
    runner.group("hover affordances");

    await runner.check(
      "hover.resize-and-point-cursors",
      "a transform handle hovers a resize cursor, a line's point a pointer one",
      async () => {
        await resetEditor(page);
        await drawRectangle(page, [500, 400], [700, 550]);
        // the nw transform handle, which sits on the selection's top-left corner
        await page.mouse.move(500, 400);
        await waitFor(
          page,
          () =>
            document.querySelector("canvas.interactive").style.cursor ===
            "nwse-resize",
          { message: "hovering the nw transform handle set no resize cursor" },
        );

        // the shape's middle, where there is no handle to resize from
        await page.mouse.move(600, 475);
        await waitFor(
          page,
          () =>
            document.querySelector("canvas.interactive").style.cursor ===
            "move",
          { message: "hovering the shape itself set no move cursor" },
        );

        await resetEditor(page);
        await page.keyboard.press("l");
        await waitFor(page, () => window.h.state.activeTool.type === "line", {
          message: "the line tool's shortcut did not activate it",
        });
        await dragCanvas(page, [500, 700], [800, 700]);
        await waitFor(
          page,
          () => window.h.state.selectedLinearElement != null,
          { message: "the drawn line did not end up selected" },
        );

        // its last point, which the hover must claim for the point handle
        await page.mouse.move(800, 700);
        await waitFor(
          page,
          () => window.h.state.selectedLinearElement?.hoverPointIndex === 1,
          {
            message: "hovering the line's last point set no hoverPointIndex",
          },
        );
        expectEqual(
          await canvasCursor(page),
          "pointer",
          "cursor over the line's last point",
        );
      },
      {
        evidence: {
          page,
          selectors: ["canvas.excalidraw__canvas.interactive"],
        },
      },
    );

    await runner.check(
      "hover.text-auto-resize-handle",
      "a wrapped text's auto-resize handle hovers a pointer cursor and unwraps the text on click",
      async () => {
        await resetEditor(page);
        await page.keyboard.press("t");
        await waitFor(page, () => window.h.state.activeTool.type === "text", {
          message: "the text tool's shortcut did not activate it",
        });
        await page.mouse.click(500, 400);
        await page.keyboard.type("Excalidraw\nEditor");
        await page.keyboard.press("Escape");
        await waitFor(
          page,
          () =>
            window.__e2e.elements().length === 1 &&
            window.h.state.selectedElementIds[window.__e2e.elements()[0].id],
          { message: "the submitted text did not end up selected" },
        );

        // narrowing the box is what wraps the text and clears `autoResize`,
        // which is what puts the handle on the canvas in the first place
        const typed = await elementBox(page);
        const eastHandle = await sceneToViewport(page, [
          typed.x + typed.width + 4,
          typed.y + typed.height / 2,
        ]);
        await dragCanvas(page, eastHandle, [eastHandle[0] - 60, eastHandle[1]]);
        await waitFor(page, () => window.h.elements[0].autoResize === false, {
          message: "narrowing the text did not wrap it",
        });

        // `getTextAutoResizeHandle`: the box's right edge plus the text box's
        // padding (`DEFAULT_TRANSFORM_HANDLE_SPACING * 2`) and the handle's
        // own 12px gap, at the box's vertical centre
        const wrapped = await elementBox(page);
        const autoResizeHandle = await sceneToViewport(page, [
          wrapped.x + wrapped.width + 4 + 12,
          wrapped.y + wrapped.height / 2,
        ]);
        await page.mouse.move(autoResizeHandle[0], autoResizeHandle[1]);
        expectEqual(
          await canvasCursor(page),
          "pointer",
          "cursor over the text's auto-resize handle",
        );

        await page.mouse.click(autoResizeHandle[0], autoResizeHandle[1]);
        await waitFor(page, () => window.h.elements[0].autoResize === true, {
          message: "clicking the auto-resize handle did not unwrap the text",
        });
      },
      {
        evidence: {
          page,
          selectors: ["canvas.excalidraw__canvas.interactive"],
        },
      },
    );
  });

  // --------------------------------------------------------------- pen mode
  await withPage("penmode", async (page) => {
    runner.group("pen mode");

    await runner.check(
      "penmode.detected-by-a-real-stylus",
      "a stylus press reveals the pen mode button, which then toggles pen mode",
      async () => {
        await resetEditor(page);

        const before = await page.evaluate(() => ({
          penDetected: window.h.state.penDetected,
          button: !!document.querySelector(".ToolIcon__penMode"),
        }));
        expect(
          !before.penDetected && !before.button,
          "pen mode was already detected before the stylus touched the canvas",
        );

        await penTapAt(page, 700, 650);

        await waitFor(
          page,
          () => !!document.querySelector(".ToolIcon__penMode"),
          { message: "a stylus press did not reveal the pen mode button" },
        );
        const detected = await page.evaluate(() => ({
          penDetected: window.h.state.penDetected,
          penMode: window.h.state.penMode,
          variability: window.h.state.currentItemStrokeVariability,
        }));
        expectEqual(detected.penDetected, true, "penDetected after a stylus");
        expectEqual(detected.penMode, true, "penMode after a stylus");
        expectEqual(
          detected.variability,
          "variable",
          "the stroke variability pen detection switches to",
        );

        const button = await occlusion(page, ".ToolIcon__penMode");
        expect(
          button.ownsPoint,
          `the pen mode button is occluded by ${button.topmost}`,
        );

        await clickCenter(page, ".ToolIcon__penMode");
        await waitFor(
          page,
          () =>
            document
              .querySelector(".ToolIcon__penMode")
              ?.getAttribute("aria-pressed") === "false",
          { message: "clicking the pen mode button did not turn pen mode off" },
        );
        expectEqual(
          await page.evaluate(() => window.h.state.penMode),
          false,
          "penMode after clicking the button",
        );
        // turning it off must not hide the button
        expectEqual(
          await page.evaluate(() => window.h.state.penDetected),
          true,
          "penDetected after clicking the button",
        );

        await clickCenter(page, ".ToolIcon__penMode");
        await waitFor(page, () => window.h.state.penMode === true, {
          message: "clicking the pen mode button again did not turn it back on",
        });
      },
      {
        evidence: {
          page,
          selectors: [".ToolIcon__penMode", ".App-toolbar"],
        },
      },
    );
  });

  // ----------------------------------------------------------------- frames
  await withPage("frames", async (page) => {
    runner.group("frame name label");

    await runner.check(
      "frames.name-label-selects-frame",
      "drawing a frame takes in what it covers, and its name label selects it",
      async () => {
        await resetEditor(page);
        await drawRectangle(page);
        await waitFor(
          page,
          () => Object.keys(window.h.state.selectedElementIds).length === 1,
          { message: "the drawn rectangle was not left selected" },
        );
        // the frame tool, through its shortcut — dragging one around the
        // rectangle both creates the frame and makes the rectangle its member
        await page.keyboard.press("f");
        await waitFor(page, () => window.h.state.activeTool.type === "frame", {
          message: "the F shortcut did not activate the frame tool",
        });
        await dragCanvas(page, [420, 320], [820, 640]);
        await waitFor(
          page,
          () => window.__e2e.elements().some((el) => el.type === "frame"),
          { message: "dragging with the frame tool created no frame" },
        );
        const els = await elements(page);
        const frame = els.find((el) => el.type === "frame");
        const rectangle = els.find((el) => el.type === "rectangle");
        const frameId = await page.evaluate(
          (id) => window.h.elements.find((el) => el.id === id)?.frameId ?? null,
          rectangle.id,
        );
        expectEqual(
          frameId,
          frame.id,
          "the drawn frame did not take in the rectangle it covers",
        );

        // drawing leaves the frame selected — the label click has to be what
        // selects it
        await page.mouse.click(1150, 800);
        await waitFor(
          page,
          () => Object.keys(window.h.state.selectedElementIds).length === 0,
          { message: "clicking empty canvas did not clear the selection" },
        );

        // the id `App.frameNameBoundsCache` looks the label's box up by
        const label = `[id="${await page.evaluate(
          (id) => `${window.h.app.id}-frame-name-${id}`,
          frame.id,
        )}"]`;
        const box = await rectOf(page, label);
        expect(
          !!box && box.width > 0 && box.height > 0,
          `the frame's name label did not render a box (${JSON.stringify(
            box,
          )})`,
        );
        // above the frame itself, so only its name can answer the hit test
        const frameTop = await page.evaluate((id) => {
          const { zoom, offsetTop, scrollY } = window.h.state;
          const el = window.h.elements.find((element) => element.id === id);
          return (el.y + scrollY) * zoom.value + offsetTop;
        }, frame.id);
        expect(
          box.y + box.height <= frameTop,
          `the name label overlaps the frame it names (label bottom ${
            box.y + box.height
          }, frame top ${frameTop})`,
        );

        await clickCenter(page, label);
        await waitFor(
          page,
          (id) => window.h.state.selectedElementIds[id] === true,
          {
            args: [frame.id],
            message: "clicking the frame's name label did not select it",
          },
        );
      },
      {
        evidence: {
          page,
          selectors: [".frame-name", "canvas.excalidraw__canvas.interactive"],
        },
      },
    );
  });

  // ----------------------------------------------------------------- eraser
  await withPage("eraser", async (page) => {
    runner.group("eraser tool");

    await runner.check(
      "eraser.drag-erases-only-what-it-crossed",
      "dragging the eraser paints its trail and erases only the shape it crossed",
      async () => {
        await resetEditor(page);

        const drawAt = async (from, to, expected) => {
          await clickCenter(page, '[data-testid="toolbar-rectangle"]');
          await waitFor(
            page,
            () => window.h.state.activeTool.type === "rectangle",
            {
              message: "the toolbar click did not activate the rectangle tool",
            },
          );
          await dragCanvas(page, from, to);
          await waitFor(page, (n) => window.__e2e.elements().length === n, {
            args: [expected],
            message: `dragging the rectangle tool did not bring the scene to ${expected} element(s)`,
          });
        };

        await drawAt([300, 250], [500, 400], 1);
        await drawAt([800, 250], [1000, 400], 2);
        const [crossed, spared] = await elements(page);

        await clickCenter(page, '[data-testid="toolbar-eraser"]');
        await waitFor(page, () => window.h.state.activeTool.type === "eraser", {
          message: "the toolbar click did not activate the eraser tool",
        });

        /**
         * The trail is an SVG path in the editor's own `.SVGLayer`, painted
         * with the eraser's light-theme fill (`EraserTrail`'s options) — so a
         * painted path with that fill is the eraser's, not the laser's or the
         * lasso's.
         */
        const ERASER_TRAIL_FILL = "rgba(0, 0, 0, 0.2)";
        const paintedTrailFills = () =>
          page.evaluate(() =>
            [...document.querySelectorAll(".SVGLayer svg path")]
              .filter((path) => (path.getAttribute("d") || "").length > 0)
              .map((path) => path.getAttribute("fill")),
          );

        expectEqual(
          JSON.stringify(await paintedTrailFills()),
          "[]",
          "the painted SVG trails before the erase drag",
        );

        await page.mouse.move(250, 325);
        await page.mouse.down();
        const paintedDuringDrag = [];
        for (let x = 270; x <= 550; x += 20) {
          await page.mouse.move(x, 325);
          paintedDuringDrag.push(...(await paintedTrailFills()));
        }
        expect(
          paintedDuringDrag.includes(ERASER_TRAIL_FILL),
          `no eraser trail was painted during the drag (painted fills: ${JSON.stringify(
            paintedDuringDrag,
          )})`,
        );
        await page.mouse.up();

        await waitFor(
          page,
          (id) =>
            !window.h.elements.find((el) => el.id === id) ||
            window.h.elements.find((el) => el.id === id).isDeleted,
          {
            args: [crossed.id],
            message: "the shape the eraser crossed survived the drag",
          },
        );
        expectEqual(
          JSON.stringify(await elements(page)),
          JSON.stringify([spared]),
          "the scene after the erase drag",
        );

        await waitFor(
          page,
          () =>
            [...document.querySelectorAll(".SVGLayer svg path")].every(
              (path) => (path.getAttribute("d") || "").length === 0,
            ),
          { message: "the eraser trail outlived the gesture that drew it" },
        );
      },
      {
        evidence: {
          page,
          selectors: [".SVGLayer svg", "canvas.excalidraw__canvas.interactive"],
        },
      },
    );
  });

  // -------------------------------------------------------------- flowchart
  await withPage("flowchart", async (page) => {
    runner.group("flowchart shortcuts");

    await runner.check(
      "flowchart.ctrl-arrow-creates-linked-node",
      "CtrlOrCmd+Arrow grows a linked node, Escape mid-preview cancels it",
      async () => {
        await resetEditor(page);
        await drawRectangle(page, [300, 300], [500, 400]);
        const [parent] = await elements(page);
        await waitFor(page, (id) => window.h.state.selectedElementIds[id], {
          args: [parent.id],
          message: "the drawn rectangle was not left selected",
        });

        // the real chord, modifier held across the arrow and released after —
        // the release is what commits the previewed cluster
        await pressWithMod(page, "ArrowRight");
        await waitFor(page, () => window.__e2e.elements().length === 3, {
          message:
            "CtrlOrCmd+ArrowRight did not commit a successor node and its arrow",
        });

        // `__e2e.elements()` projects only id and type, and the assertions
        // below are about geometry and bindings
        const grown = await page.evaluate((parentId) => {
          const shape = (el) =>
            el && {
              id: el.id,
              x: el.x,
              width: el.width,
              startBinding: el.startBinding?.elementId ?? null,
              endBinding: el.endBinding?.elementId ?? null,
            };
          const live = window.h.elements.filter((el) => !el.isDeleted);
          return {
            parent: shape(live.find((el) => el.id === parentId)),
            child: shape(
              live.find((el) => el.type === "rectangle" && el.id !== parentId),
            ),
            arrow: shape(live.find((el) => el.type === "arrow")),
          };
        }, parent.id);

        expect(grown.child, "no successor rectangle was created");
        expect(grown.arrow, "no arrow was created between the two nodes");
        expect(
          grown.child.x > grown.parent.x + grown.parent.width,
          `the successor landed at x=${grown.child.x}, not to the right of the parent`,
        );
        expectEqual(
          grown.arrow.startBinding,
          parent.id,
          "the arrow's start binding",
        );
        expectEqual(
          grown.arrow.endBinding,
          grown.child.id,
          "the arrow's end binding",
        );
        await waitFor(page, (id) => window.h.state.selectedElementIds[id], {
          args: [grown.child.id],
          message: "the committed successor was not selected",
        });

        // Escape mid-preview drops the pending cluster, so releasing the
        // modifier afterwards commits nothing
        const mod = process.platform === "darwin" ? "Meta" : "Control";
        await page.keyboard.down(mod);
        await page.keyboard.press("ArrowDown");
        await waitFor(page, () => !!window.h.app.flowchart.isCreatingChart, {
          message: "holding the modifier over an arrow started no preview",
        });
        await page.keyboard.press("Escape");
        await waitFor(page, () => !window.h.app.flowchart.isCreatingChart, {
          message: "Escape did not end the flowchart preview",
        });
        await page.keyboard.up(mod);

        expectEqual(
          (await elements(page)).length,
          3,
          "the element count after an escaped preview",
        );
      },
      {
        evidence: {
          page,
          selectors: ["canvas.excalidraw__canvas.static", ".excalidraw"],
        },
      },
    );
  });

  // ------------------------------------------------------------- crop editor
  await withPage("crop", async (page) => {
    runner.group("image crop editor");

    await runner.check(
      "crop.drag-inside-region-pans",
      "dragging inside a cropped image's region pans the image, it does not move or resize it",
      async () => {
        await resetEditor(page);
        await dropImage(page, [500, 350]);
        // the drop selects the inserted image, so Enter opens the crop editor
        await page.keyboard.press("Enter");
        await waitFor(page, () => !!window.h.state.croppingElementId, {
          message: "Enter did not open the crop editor for the dropped image",
        });

        // crop the west edge in first: panning applies to an already-cropped
        // image, and this also leaves slack to pan into
        const armed = await imageGeometry(page);
        await dragCanvas(page, armed.west, [armed.west[0] + 40, armed.west[1]]);
        await waitFor(
          page,
          () =>
            window.h.elements.filter((el) => !el.isDeleted)[0].crop !== null,
          { message: "dragging the west crop handle did not crop the image" },
        );

        const before = await imageGeometry(page);
        expect(
          before.element.crop.x > 0,
          `the west crop drag left no slack to pan into (crop ${JSON.stringify(
            before.element.crop,
          )})`,
        );

        await dragCanvas(page, before.centre, [
          before.centre[0] + 20,
          before.centre[1] + 12,
        ]);

        const after = await imageGeometry(page);
        // the image panned inside its frame...
        expect(
          after.element.crop.x < before.element.crop.x,
          `dragging right inside the region left the crop at x ${after.element.crop.x} (was ${before.element.crop.x})`,
        );
        // ...and neither the frame nor the crop window changed size
        expectEqual(
          `${after.element.x},${after.element.y},${after.element.width},${after.element.height}`,
          `${before.element.x},${before.element.y},${before.element.width},${before.element.height}`,
          "the image's frame after the pan",
        );
        expectEqual(
          `${after.element.crop.width},${after.element.crop.height}`,
          `${before.element.crop.width},${before.element.crop.height}`,
          "the crop window's size after the pan",
        );
        const state = await page.evaluate(() => ({
          croppingElementId: window.h.state.croppingElementId,
          isCropping: window.h.state.isCropping,
        }));
        expectEqual(
          state.croppingElementId,
          after.element.id,
          "the element still being cropped after the pan",
        );
        expect(
          state.isCropping === false,
          "a pan inside the region flagged `isCropping`, which belongs to crop-handle drags",
        );
      },
      {
        evidence: {
          page,
          selectors: ["canvas.excalidraw__canvas.interactive"],
        },
      },
    );
  });

  // -------------------------------------------------- mermaid / CodeMirror
  await withPage("mermaid", async (page) => {
    runner.group("mermaid dialog (CodeMirror editor)");

    const editorSelector = ".ttd-dialog-input--codemirror .cm-editor";
    const errorSelector = '[data-testid="ttd-dialog-output-error"]';

    /**
     * Opens the mermaid tab of the TTD dialog from the toolbar, on a cleared
     * definition so every check starts from upstream's seeded example. The
     * key is `EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW`, which the dialog reads
     * once, at construction — and which a previous check's typing has left
     * behind by then.
     */
    const openMermaidDialog = async () => {
      await resetEditor(page);
      await page.evaluate(() =>
        localStorage.removeItem("mermaid-to-excalidraw"),
      );
      // the trigger toggles, and the open flag is component state that
      // `resetEditor` cannot reach — so normalise before opening
      const dropdownSelector =
        ".App-toolbar__extra-tools-dropdown .dropdown-menu-container";
      if (
        await page.evaluate(
          (sel) => !!document.querySelector(sel),
          dropdownSelector,
        )
      ) {
        await clickCenter(page, ".App-toolbar__extra-tools-trigger");
        await waitFor(page, (sel) => !document.querySelector(sel), {
          message: "extra-tools dropdown would not close",
          args: [dropdownSelector],
        });
      }
      await clickCenter(page, ".App-toolbar__extra-tools-trigger");
      await waitFor(page, (sel) => !!document.querySelector(sel), {
        message: "extra-tools dropdown did not open",
        args: [dropdownSelector],
      });
      // the mermaid entry carries `toolbar-embeddable`, as upstream's own
      // copy/paste does, so it is picked out by label and clicked for real
      const target = await page.evaluate(() => {
        const item = [
          ...document.querySelectorAll(
            '.App-toolbar__extra-tools-dropdown [data-testid="toolbar-embeddable"]',
          ),
        ].find((el) => el.textContent.includes("Mermaid"));
        if (!item) {
          return null;
        }
        const r = item.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      expect(target, "the extra-tools dropdown has no `Mermaid` entry to open");
      await page.mouse.click(target.x, target.y);
      await waitFor(page, () => !!document.querySelector(".Modal.ttd-dialog"), {
        message: "the mermaid dialog did not open",
      });
      await waitFor(page, (sel) => !!document.querySelector(sel), {
        message:
          "the CodeMirror editor never mounted — the dialog is on its textarea fallback",
        args: [editorSelector],
        timeout: 20000,
      });
    };

    /** the editor's document, read off the rendered lines */
    const editorDoc = () =>
      page.evaluate(() =>
        [...document.querySelectorAll(".cm-content .cm-line")]
          .map((line) => line.textContent)
          .join("\n"),
      );

    const previewCanvas = () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          ".ttd-dialog-output-canvas-content canvas",
        );
        return canvas ? { width: canvas.width, height: canvas.height } : null;
      });

    /** replace the whole definition the way a person would: click into the
     * editor, select all, delete, type */
    const retype = async (text) => {
      await clickCenter(page, ".cm-content");
      await pressWithMod(page, "a");
      await page.keyboard.press("Backspace");
      await page.keyboard.type(text);
    };

    await runner.check(
      "mermaid.codemirror-mounts",
      "the mermaid dialog mounts CodeMirror, not the textarea fallback",
      async () => {
        await openMermaidDialog();
        const mounted = await page.evaluate(() => {
          const host = document.querySelector(".ttd-dialog-input--codemirror");
          const rect = host.getBoundingClientRect();
          return {
            tag: host.tagName.toLowerCase(),
            display: getComputedStyle(host).display,
            editors: document.querySelectorAll(".cm-editor").length,
            textareas: document.querySelectorAll("textarea.ttd-dialog-input")
              .length,
            lineNumbers: document.querySelectorAll(
              ".cm-gutters .cm-lineNumbers .cm-gutterElement",
            ).length,
            highlighted: document.querySelectorAll(".cm-content .cm-line span")
              .length,
            focused:
              document.activeElement?.classList.contains("cm-content") ?? false,
            height: Math.round(rect.height),
          };
        });
        expectEqual(mounted.editors, 1, "mounted `.cm-editor` count");
        expectEqual(
          mounted.textareas,
          0,
          "textarea fallbacks rendered alongside CodeMirror",
        );
        expectEqual(
          mounted.display,
          "block",
          "`.ttd-dialog-input--codemirror` display",
        );
        expect(
          mounted.height > 100,
          `the editor collapsed to ${mounted.height}px tall`,
        );
        expect(
          mounted.lineNumbers > 0,
          "the CodeMirror gutter rendered no line numbers",
        );
        expect(
          mounted.highlighted > 0,
          "the mermaid definition rendered no syntax-highlighted tokens",
        );
        expect(
          mounted.focused,
          "opening the dialog did not focus the CodeMirror editor",
        );
        const doc = await editorDoc();
        expect(
          doc.startsWith("flowchart TD"),
          `the editor opened on \`${doc.slice(
            0,
            40,
          )}\`, not the seeded example`,
        );
      },
      {
        evidence: {
          page,
          selectors: [".ttd-dialog-input--codemirror", ".cm-editor"],
        },
      },
    );

    await runner.check(
      "mermaid.codemirror-drives-preview",
      "typing a definition into CodeMirror re-renders the preview",
      async () => {
        await openMermaidDialog();
        await waitFor(
          page,
          () =>
            !!document.querySelector(
              ".ttd-dialog-output-canvas-content canvas",
            ),
          { message: "the seeded example never rendered a preview" },
        );
        const before = await previewCanvas();
        await retype("flowchart LR\nSolo[Only node]");
        expectEqual(
          await editorDoc(),
          "flowchart LR\nSolo[Only node]",
          "the editor document after typing",
        );
        await waitFor(
          page,
          (w, h) => {
            const canvas = document.querySelector(
              ".ttd-dialog-output-canvas-content canvas",
            );
            return !!canvas && (canvas.width !== w || canvas.height !== h);
          },
          {
            message: `the preview stayed at ${before.width}x${before.height} after the definition was retyped`,
            args: [before.width, before.height],
            timeout: 10000,
          },
        );
        expect(
          await page.evaluate(
            (sel) => !document.querySelector(sel),
            errorSelector,
          ),
          "a valid definition typed into CodeMirror rendered a parse error",
        );
      },
      {
        evidence: {
          page,
          selectors: [".cm-content", ".ttd-dialog-output-canvas-content"],
        },
      },
    );

    await runner.check(
      "mermaid.codemirror-error-line",
      "a parse error decorates the offending line, and fixing it clears the decoration",
      async () => {
        await openMermaidDialog();
        await retype("flowchart TD\nA[Fine] --> B[Also fine]\nB --> ((((");
        await waitFor(page, (sel) => !!document.querySelector(sel), {
          message: "the broken definition raised no parse error",
          args: [errorSelector],
          timeout: 10000,
        });
        await waitFor(
          page,
          () => document.querySelectorAll(".cm-errorLine").length === 1,
          {
            message:
              "the parse error decorated no line in the CodeMirror editor",
            timeout: 10000,
          },
        );
        const decorated = await page.evaluate(() => {
          const line = document.querySelector(".cm-errorLine");
          return {
            text: line.textContent,
            background: getComputedStyle(line).backgroundColor,
          };
        });
        expectEqual(
          decorated.text,
          "B --> ((((",
          "the line the parse error decorated",
        );
        expect(
          alphaOf(decorated.background) > 0,
          `the decorated line paints no background (${decorated.background})`,
        );

        await retype("flowchart TD\nA[Fine] --> B[Also fine]");
        await waitFor(page, (sel) => !document.querySelector(sel), {
          message: "fixing the definition left the parse error showing",
          args: [errorSelector],
          timeout: 10000,
        });
        await waitFor(
          page,
          () => document.querySelectorAll(".cm-errorLine").length === 0,
          {
            message: "the error-line decoration survived a fixed definition",
            timeout: 10000,
          },
        );
      },
      {
        evidence: {
          page,
          selectors: [".cm-errorLine", ".ttd-dialog-output-error"],
        },
      },
    );

    await runner.check(
      "mermaid.codemirror-follows-theme",
      "the editor repaints when the editor theme changes under it",
      async () => {
        await openMermaidDialog();
        const read = () =>
          page.evaluate(() => ({
            editor: getComputedStyle(document.querySelector(".cm-editor"))
              .backgroundColor,
            gutters: getComputedStyle(document.querySelector(".cm-gutters"))
              .backgroundColor,
          }));
        // upstream's own light/dark `EditorView.theme` palettes
        expectEqual(
          JSON.stringify(await read()),
          JSON.stringify({
            editor: "rgb(255, 255, 255)",
            gutters: "rgb(255, 255, 255)",
          }),
          "the editor's light-theme background",
        );
        // the dialog is modal, so the theme is flipped through the same test
        // hook `resetEditor` drives the rest of the suite's app state with
        await page.evaluate(() => window.h.setState({ theme: "dark" }));
        await waitFor(
          page,
          () =>
            getComputedStyle(document.querySelector(".cm-editor"))
              .backgroundColor === "rgb(30, 30, 30)",
          {
            message:
              "switching to the dark theme left the CodeMirror editor light",
          },
        );
        expectEqual(
          JSON.stringify(await read()),
          JSON.stringify({
            editor: "rgb(30, 30, 30)",
            gutters: "rgb(30, 30, 30)",
          }),
          "the editor's dark-theme background",
        );
        await page.evaluate(() => window.h.setState({ theme: "light" }));
        await waitFor(
          page,
          () =>
            getComputedStyle(document.querySelector(".cm-editor"))
              .backgroundColor === "rgb(255, 255, 255)",
          {
            message:
              "switching back to the light theme left the CodeMirror editor dark",
          },
        );
      },
      {
        evidence: {
          page,
          selectors: [".cm-editor", ".cm-gutters"],
        },
      },
    );
  });

  // ------------------------------------------------------------- embeds
  await withPage("embeds", async (page) => {
    runner.group("embeddable iframes");

    await runner.check(
      "embeds.pasted-link-mounts-an-iframe",
      "pasting a video link mounts a sandboxed iframe the centre click activates",
      async () => {
        await resetEditor(page);

        // the embed's own src is youtube: the check asserts the mounted DOM,
        // never a loaded video, so the frame is kept off the network entirely
        await page.setRequestInterception(true);
        const blockEmbedHosts = (request) => {
          if (
            /youtube\.com|youtu\.be|ytimg\.com|googlevideo\.com/.test(
              request.url(),
            )
          ) {
            request.abort().catch(() => {});
          } else {
            request.continue().catch(() => {});
          }
        };
        page.on("request", blockEmbedHosts);

        try {
          // paste lands where the cursor is, and only while the editor holds
          // focus with the canvas under the pointer
          await page.mouse.move(700, 450);
          await page.mouse.click(700, 450);
          await page.evaluate((link) => {
            const data = new DataTransfer();
            data.setData("text/plain", link);
            document.dispatchEvent(
              new ClipboardEvent("paste", {
                clipboardData: data,
                bubbles: true,
                cancelable: true,
              }),
            );
          }, "https://www.youtube.com/watch?v=gkGMXY0wekg");

          await waitFor(
            page,
            () =>
              window.__e2e.elements().some((el) => el.type === "embeddable"),
            { message: "pasting a youtube link created no embeddable element" },
          );

          await waitFor(
            page,
            () =>
              !!document.querySelector(
                ".excalidraw__embeddable-container iframe.excalidraw__embeddable",
              ),
            { message: "the embeddable element mounted no iframe" },
          );

          const mounted = await page.evaluate(() => {
            const container = document.querySelector(
              ".excalidraw__embeddable-container",
            );
            const iframe = container.querySelector(
              "iframe.excalidraw__embeddable",
            );
            const inner = container.querySelector(
              ".excalidraw__embeddable-container__inner",
            );
            return {
              parent: container.parentElement.tagName.toLowerCase(),
              inEditor: !!container.closest(".excalidraw"),
              display: getComputedStyle(container).display,
              position: getComputedStyle(container).position,
              src: iframe.getAttribute("src"),
              sandbox: iframe.getAttribute("sandbox"),
              allow: iframe.getAttribute("allow"),
              referrerPolicy: iframe.getAttribute("referrerpolicy"),
              title: iframe.getAttribute("title"),
              allowFullscreen: iframe.hasAttribute("allowfullscreen"),
              pointerEvents: getComputedStyle(inner).pointerEvents,
            };
          });

          expect(
            mounted.inEditor,
            "the embeddable container mounted outside the editor container",
          );
          expectEqual(mounted.position, "absolute", "container position");
          expectEqual(mounted.display, "block", "container display");
          expectEqual(
            mounted.src,
            "https://www.youtube.com/embed/gkGMXY0wekg?enablejsapi=1",
            "the iframe's resolved embed src",
          );
          expectEqual(
            mounted.sandbox,
            "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads",
            "the iframe's sandbox",
          );
          expectEqual(
            mounted.allow,
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
            "the iframe's allow list",
          );
          expectEqual(
            mounted.referrerPolicy,
            "no-referrer-when-downgrade",
            "the iframe's referrer policy",
          );
          expectEqual(
            mounted.title,
            "Excalidraw Embedded Content",
            "the iframe's title",
          );
          expect(mounted.allowFullscreen, "the iframe is not allowFullscreen");
          expectEqual(
            mounted.pointerEvents,
            "none",
            "an inactive embed's pointer-events",
          );

          // the centre third of an embed is its activation target
          const centre = await page.evaluate(() => {
            const el = window.h.elements.find(
              (element) => element.type === "embeddable",
            );
            const { zoom, offsetLeft, offsetTop, scrollX, scrollY } =
              window.h.state;
            return [
              (el.x + el.width / 2 + scrollX) * zoom.value + offsetLeft,
              (el.y + el.height / 2 + scrollY) * zoom.value + offsetTop,
            ];
          });
          await page.mouse.click(centre[0], centre[1]);

          await waitFor(
            page,
            () => window.h.state.activeEmbeddable?.state === "active",
            {
              message: "clicking the centre of the embed did not activate it",
              timeout: 3000,
            },
          );
          await waitFor(
            page,
            () =>
              getComputedStyle(
                document.querySelector(
                  ".excalidraw__embeddable-container__inner",
                ),
              ).pointerEvents === "all",
            {
              message:
                "an active embed still refuses pointer events, so it cannot be interacted with",
            },
          );

          await page.keyboard.press("Escape");
          await waitFor(page, () => window.h.state.activeEmbeddable === null, {
            message: "Escape did not deactivate the embed",
          });
          await waitFor(
            page,
            () =>
              getComputedStyle(
                document.querySelector(
                  ".excalidraw__embeddable-container__inner",
                ),
              ).pointerEvents === "none",
            {
              message:
                "a deactivated embed still swallows pointer events meant for the canvas",
            },
          );
        } finally {
          page.off("request", blockEmbedHosts);
          await page.setRequestInterception(false);
        }
      },
      {
        evidence: {
          page,
          selectors: [
            ".excalidraw__embeddable-container",
            "iframe.excalidraw__embeddable",
          ],
        },
      },
    );
  });

  // ------------------------------------------------------------- mobile
  await withPage(
    "mobile",
    async (page) => {
      runner.group("mobile chrome (phone emulation)");

      await runner.check(
        "mobile.form-factor",
        "a phone viewport and user agent derive the phone form factor",
        async () => {
          const derived = await page.evaluate(() => ({
            formFactor: window.h.app.editorInterface.formFactor,
            isMobileDevice:
              window.h.app.editorInterface.userAgent.isMobileDevice,
            platform: window.h.app.editorInterface.userAgent.platform,
            isLandscape: window.h.app.editorInterface.isLandscape,
            canFitSidebar: window.h.app.editorInterface.canFitSidebar,
          }));
          expectEqual(derived.formFactor, "phone", "the derived form factor");
          expectEqual(
            derived.isMobileDevice,
            true,
            "userAgent.isMobileDevice on a phone user agent",
          );
          expectEqual(derived.platform, "android", "the derived platform");
          expectEqual(derived.isLandscape, false, "isLandscape in portrait");
          expectEqual(derived.canFitSidebar, false, "canFitSidebar on a phone");
        },
        { evidence: { page, selectors: [".excalidraw"] } },
      );

      await runner.check(
        "mobile.layout",
        "the mobile menu replaces the desktop layout",
        async () => {
          const layout = await page.evaluate(() => ({
            bottomBar: !!document.querySelector(".App-bottom-bar"),
            toolbar: !!document.querySelector(".mobile-toolbar"),
            topBar: !!document.querySelector(".App-top-bar"),
            desktopWrapper: !!document.querySelector(".layer-ui__wrapper"),
            desktopToolbar: !!document.querySelector(".App-toolbar-container"),
            mobileClass: document
              .querySelector(".excalidraw")
              .classList.contains("excalidraw--mobile"),
            mobileToolbarClass: document
              .querySelector(".excalidraw")
              .classList.contains("excalidraw--mobile-toolbar"),
          }));
          expect(layout.bottomBar, ".App-bottom-bar did not render");
          expect(layout.toolbar, ".mobile-toolbar did not render");
          expect(layout.topBar, ".App-top-bar did not render");
          expect(
            !layout.desktopWrapper,
            ".layer-ui__wrapper (the desktop layout) rendered on a phone",
          );
          expect(
            !layout.desktopToolbar,
            ".App-toolbar-container (the desktop toolbar) rendered on a phone",
          );
          expect(
            layout.mobileClass && layout.mobileToolbarClass,
            "the container is missing excalidraw--mobile / --mobile-toolbar",
          );
          const bar = await rectOf(page, ".App-bottom-bar");
          expect(bar && bar.width > 0, "the bottom bar has no width");
        },
        {
          evidence: {
            page,
            selectors: [".App-bottom-bar", ".mobile-toolbar", ".App-top-bar"],
          },
        },
      );

      await runner.check(
        "mobile.tool-popover",
        "a real tap opens the shape popover and picks a tool from it",
        async () => {
          await tapCenter(
            page,
            '.mobile-toolbar [data-testid="toolbar-rectangle"]',
          );
          await waitFor(
            page,
            () => !!document.querySelector(".tool-popover-content"),
            { message: "tapping the shape trigger opened no tool popover" },
          );
          expectEqual(
            (await appState(page)).activeTool,
            "rectangle",
            "the tool the trigger activates",
          );
          const popover = await occlusion(page, ".tool-popover-content");
          expect(
            popover.ownsPoint,
            `the tool popover is occluded by ${popover.topmost}`,
          );

          await tapCenter(
            page,
            '.tool-popover-content [data-testid="toolbar-ellipse"]',
          );
          await waitFor(
            page,
            () => window.h.state.activeTool.type === "ellipse",
            { message: "tapping the ellipse option did not activate it" },
          );
          // the trigger now displays (and re-activates) the picked option
          await waitFor(
            page,
            () =>
              document
                .querySelector(
                  '.mobile-toolbar [data-testid="toolbar-rectangle"]',
                )
                ?.getAttribute("aria-pressed") === "true",
            {
              message:
                "the shape trigger did not follow the option picked from its popover",
            },
          );
        },
        {
          evidence: {
            page,
            selectors: [
              ".tool-popover-content",
              '.mobile-toolbar [data-testid="toolbar-rectangle"]',
            ],
          },
        },
      );

      await runner.check(
        "mobile.styles-panel",
        "the mobile styles panel renders with the compact color triggers",
        async () => {
          await waitFor(
            page,
            () => !!document.querySelector(".mobile-shape-actions"),
            { message: "the mobile styles panel did not render for a tool" },
          );
          const panel = await page.evaluate(() => ({
            compactTriggers: document.querySelectorAll(
              ".mobile-shape-actions .color-picker__button.compact-sizing",
            ).length,
            topPicks: document.querySelectorAll(
              ".mobile-shape-actions .color-picker__top-picks",
            ).length,
            undo: !!document.querySelector(
              '.mobile-shape-actions [data-testid="button-undo"]',
            ),
            redo: !!document.querySelector(
              '.mobile-shape-actions [data-testid="button-redo"]',
            ),
          }));
          expect(
            panel.compactTriggers > 0,
            "no compact color triggers in the mobile styles panel",
          );
          expectEqual(
            panel.topPicks,
            0,
            "top-pick strips rendered in the mobile styles panel",
          );
          expect(panel.undo && panel.redo, "the undo/redo column is missing");
        },
        { evidence: { page, selectors: [".mobile-shape-actions"] } },
      );

      await runner.check(
        "mobile.overflow-promotion",
        "a wide enough phone promotes duplicate and delete out of the popover",
        async () => {
          // upstream's `MobileShapeActions` measures its own island and lifts
          // delete, then duplicate, out of the "…" popover as room appears
          await page.setViewport(PHONE_LANDSCAPE);
          await waitFor(
            page,
            () => window.h.app.editorInterface.isLandscape === true,
            { message: "rotating to landscape left isLandscape false" },
          );

          // the panel's extra actions need a selection, and the drag that
          // makes one needs a shape tool of its own rather than whatever the
          // preceding check left active
          await tapCenter(
            page,
            '.mobile-toolbar [data-testid="toolbar-rectangle"]',
          );
          await dragCanvas(page, [260, 130], [420, 240]);
          await waitFor(page, () => window.h.elements.length === 1, {
            message: "dragging on the canvas created no element",
          });
          await waitFor(
            page,
            () => !!document.querySelector(".mobile-shape-actions"),
            { message: "the mobile styles panel did not render" },
          );

          const promoted = await page.evaluate(() => {
            const panel = document.querySelector(".mobile-shape-actions");
            return {
              width: Math.round(panel.getBoundingClientRect().width),
              duplicate: panel.querySelectorAll('[aria-label="Duplicate"]')
                .length,
              delete: panel.querySelectorAll('[aria-label="Delete"]').length,
              popoverOpen: !!document.querySelector(".properties-content"),
            };
          });
          // 9 * 32 + 8 * 6 + 2 * (32 + 6) = 412px is upstream's threshold for
          // promoting both
          expect(
            promoted.width >= 412,
            `the landscape styles panel measured ${promoted.width}px, too narrow to promote either action`,
          );
          expect(
            !promoted.popoverOpen,
            "the properties popover was open, so its own copies would be counted",
          );
          expectEqual(promoted.delete, 1, "delete buttons outside the popover");
          expectEqual(
            promoted.duplicate,
            1,
            "duplicate buttons outside the popover",
          );

          await resetEditor(page);
          await page.setViewport(PHONE.viewport);
          await waitFor(
            page,
            () => window.h.app.editorInterface.isLandscape === false,
            { message: "rotating back to portrait left isLandscape true" },
          );
        },
        {
          evidence: {
            page,
            selectors: [".mobile-shape-actions", ".App-bottom-bar"],
          },
        },
      );

      await runner.check(
        "mobile.double-tap-text",
        "tapping twice with one finger opens the text editor",
        async () => {
          await resetEditor(page);
          // Chrome synthesizes a `dblclick` from two taps, which the editor's
          // own double-click binding would answer whether or not the touch
          // layer is ported. Cancelling it in the capture phase leaves the
          // tap-twice handler — which calls `handleCanvasDoubleClick` directly
          // — as the only thing that can open an editor here.
          await suppressNativeEvent(page, "dblclick");
          try {
            await page.touchscreen.tap(196, 420);
            await page.touchscreen.tap(196, 420);
            await waitFor(
              page,
              () =>
                !!document.querySelector(
                  ".excalidraw-textEditorContainer textarea",
                ),
              { message: "tapping twice opened no text editor" },
            );
          } finally {
            await restoreNativeEvent(page, "dblclick");
          }
          await page.keyboard.press("Escape");
          await resetEditor(page);
        },
        {
          evidence: {
            page,
            selectors: [".excalidraw-textEditorContainer", ".excalidraw"],
          },
        },
      );

      await runner.check(
        "mobile.long-press-context-menu",
        "holding a finger still on the canvas opens the context menu",
        async () => {
          await resetEditor(page);
          // same again for Chrome's own long-press `contextmenu` event: the
          // ported timer calls `handleCanvasContextMenu` directly, so only it
          // can still open the menu once the native event is cancelled
          await suppressNativeEvent(page, "contextmenu");
          await page.touchscreen.touchStart(196, 420);
          try {
            await waitFor(
              page,
              () => !!document.querySelector(".context-menu"),
              { message: "a long press opened no context menu" },
            );
          } finally {
            await page.touchscreen.touchEnd();
            await restoreNativeEvent(page, "contextmenu");
          }
          await page.keyboard.press("Escape");
          await resetEditor(page);
        },
        {
          evidence: { page, selectors: [".context-menu", ".excalidraw"] },
        },
      );

      await runner.check(
        "mobile.two-finger-deselect",
        "a second finger on the canvas drops the selection",
        async () => {
          await resetEditor(page);
          // draw a rectangle with a finger — creating it leaves it selected.
          // It is filled, so that a press inside it hits the element and
          // keeps the selection instead of clearing it as a canvas miss
          await page.evaluate(() => {
            window.h.setState({ currentItemBackgroundColor: "#ffec99" });
            window.h.app.setActiveTool({ type: "rectangle" });
          });
          const drawing = await page.touchscreen.touchStart(120, 500);
          await drawing.move(260, 620);
          await drawing.end();
          await waitFor(
            page,
            () => Object.keys(window.h.state.selectedElementIds).length === 1,
            { message: "drawing a rectangle by touch selected nothing" },
          );
          // let the tap-twice window close, so the first finger below is a
          // fresh gesture rather than the second tap of the drawing one
          await settleTapTwiceWindow(page);

          // both fingers land ON the selected rectangle: a press there keeps
          // the selection (it starts a drag), so only the two-finger
          // `touchstart` branch can drop it
          const first = await page.touchscreen.touchStart(160, 540);
          const second = await page.touchscreen.touchStart(230, 600);
          try {
            await waitFor(
              page,
              () => Object.keys(window.h.state.selectedElementIds).length === 0,
              { message: "a second finger left the selection in place" },
            );
            const textEditor = await page.evaluate(
              () =>
                !!document.querySelector(
                  ".excalidraw-textEditorContainer textarea",
                ),
            );
            expect(
              !textEditor,
              "the fingers were read as a double tap, not as two fingers",
            );
          } finally {
            await second.end();
            await first.end();
          }
          await resetEditor(page);
        },
        {
          evidence: { page, selectors: [".excalidraw"] },
        },
      );

      await runner.check(
        "mobile.rotation",
        "rotating the device re-derives the form factor",
        async () => {
          await page.setViewport(PHONE_LANDSCAPE);
          await waitFor(
            page,
            () => window.h.app.editorInterface.isLandscape === true,
            { message: "rotating to landscape left isLandscape false" },
          );
          const landscape = await page.evaluate(() => ({
            formFactor: window.h.app.editorInterface.formFactor,
            mobileToolbar: !!document.querySelector(".mobile-toolbar"),
          }));
          // 851x393 is still inside the landscape mobile breakpoint
          expectEqual(
            landscape.formFactor,
            "phone",
            "the form factor in landscape",
          );
          expect(
            landscape.mobileToolbar,
            "the mobile toolbar disappeared in landscape",
          );

          await page.setViewport(TABLET);
          await waitFor(
            page,
            () => window.h.app.editorInterface.formFactor === "tablet",
            {
              message:
                "a tablet viewport did not derive the tablet form factor",
            },
          );
          const tablet = await page.evaluate(() => ({
            compactToolbar: !!document.querySelector(".App-toolbar--compact"),
            desktopWrapper: !!document.querySelector(".layer-ui__wrapper"),
            mobileToolbar: !!document.querySelector(".mobile-toolbar"),
            groupedSelection: !!document.querySelector(
              '.App-toolbar [data-testid="toolbar-selection"]',
            ),
          }));
          expect(
            tablet.desktopWrapper,
            "the desktop layout did not come back on a tablet",
          );
          expect(
            !tablet.mobileToolbar,
            "the mobile toolbar survived the switch to a tablet",
          );
          expect(
            tablet.compactToolbar,
            "the tablet toolbar is missing App-toolbar--compact",
          );
          expect(
            tablet.groupedSelection,
            "the compact toolbar has no grouped selection trigger",
          );

          // the styles panel only renders for a selection or a drawing tool
          await tapCenter(
            page,
            '.App-toolbar [data-testid="toolbar-rectangle"]',
          );
          await waitFor(
            page,
            () => !!document.querySelector(".compact-shape-actions"),
            {
              message:
                "the compact styles panel did not render for the active tool on a tablet",
            },
          );
        },
        {
          evidence: {
            page,
            selectors: [".App-toolbar", ".compact-shape-actions"],
          },
        },
      );
    },
    { emulate: PHONE },
  );
};
