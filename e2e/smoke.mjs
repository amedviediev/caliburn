/**
 * Real-browser interactive smoke suite for the caliburn app.
 *
 * Every check clicks, types and drags the way a person does, then asserts a
 * real outcome: appState read through the editor's `window.h` test hook,
 * element counts, bounding boxes, computed styles, and `elementsFromPoint`
 * occlusion (the honest answer to both "is this clickable" and "is anything
 * bleeding through it"). Screenshots are failure artifacts only — nothing is
 * asserted by comparing pixels.
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
  pressWithMod,
  probe,
  rectOf,
  resetEditor,
  screenshot,
  VIEWPORT,
  waitFor,
  waitForAnimations,
} from "./lib/browser.mjs";
import { expect, expectEqual } from "./lib/runner.mjs";

const MAIN_MENU_ITEMS = [
  "load-button",
  "json-export-button",
  "image-export-button",
  "collab-button",
  "command-palette-button",
  "search-menu-button",
  "help-menu-item",
  "clear-canvas-button",
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
 * produce. On failure the message carries the occlusion report, so an
 * unclickable control reads as "the canvas ate the click" rather than a bare
 * timeout.
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
  } catch {
    throw new Error(`${message} [${await occlusionDetail(page, selector)}]`);
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

export const runSuite = async (browser, url, runner) => {
  const withPage = async (name, body) => {
    const page = await openPage(browser, url);
    try {
      await body(page);
    } finally {
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
    );

    await runner.check(
      "baseline.hamburger-menu-items",
      "every hamburger menu item is present, enabled and clickable",
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
        // and the sample item actually does its job
        await clickCenter(page, '[data-testid="help-menu-item"]');
        await waitFor(page, () => window.h.state.openDialog?.name === "help", {
          message: "clicking Help did not open the help dialog",
        });
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
    );

    await runner.check(
      "help.owns-its-pixels",
      "help dialog is the topmost thing where it is drawn",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        if (process.env.E2E_ARTIFACTS !== "0") {
          await screenshot(page, "help-open");
        }
        await expectOwnsPixels(
          page,
          ".HelpDialog .Modal__content",
          "help dialog",
        );
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
    );

    await runner.check(
      "help.close-via-button",
      "the dialog's own close button closes it",
      async () => {
        await resetEditor(page);
        await openHelpDialog(page);
        const closeBtn = await rectOf(page, ".HelpDialog .Dialog__close");
        expect(closeBtn, ".HelpDialog has no `.Dialog__close` button to click");
        await clickAndExpect(
          page,
          ".HelpDialog .Dialog__close",
          () => !document.querySelector(".Modal.HelpDialog"),
          { message: "the close button did not close the help dialog" },
        );
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
    );

    await runner.check(
      "palette.solid-background",
      "the palette island is solid — nothing shows through it",
      async () => {
        await resetEditor(page);
        await openPalette();
        if (process.env.E2E_ARTIFACTS !== "0") {
          await screenshot(page, "palette-open");
        }
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
        if (process.env.E2E_ARTIFACTS !== "0") {
          await screenshot(page, "extra-tools-open");
        }
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
        if (process.env.E2E_ARTIFACTS !== "0") {
          await screenshot(page, "sidebar-open");
        }
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
          await dragCanvas(page, [700, 500], [820, 620]);
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
    );
  });
};
