import React from "react";

import { DEFAULT_SIDEBAR, KEYS, THEME } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { act, fireEvent, getByTestId, render, waitFor } from "./test-utils";

import type { RenderResult } from "./test-utils";

const { h } = window;

let renderResult: RenderResult;

const dialog = () =>
  renderResult.container.querySelector(".Modal.command-palette-dialog");

const input = () =>
  renderResult.container.querySelector<HTMLInputElement>(
    ".command-palette-dialog input",
  )!;

const items = () =>
  Array.from(
    renderResult.container.querySelectorAll<HTMLElement>(".command-item"),
  );

const labels = () =>
  items().map((item) => item.querySelector(".name")!.textContent!.trim());

const categoryTitles = () =>
  Array.from(
    renderResult.container.querySelectorAll(".command-category-title"),
  ).map((title) => title.textContent!.trim());

const openPalette = () => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.SLASH);
  });
};

const filter = (query: string) => {
  openPalette();
  const field = input();
  act(() => {
    updateTextEditor(field, query);
  });
  return field;
};

beforeEach(async () => {
  renderResult = await render(<Excalidraw handleKeyboardGlobally />);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("CommandPalette", () => {
  it("toggles with the CtrlOrCmd+/ shortcut", () => {
    expect(dialog()).toBeNull();

    openPalette();

    expect(h.state.openDialog).toEqual({ name: "commandPalette" });
    expect(dialog()).not.toBeNull();
    expect(input()).not.toBeNull();

    openPalette();

    expect(h.state.openDialog).toBeNull();
    expect(dialog()).toBeNull();
  });

  it("opens with the CtrlOrCmd+Shift+P shortcut", () => {
    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.P);
    });

    expect(h.state.openDialog).toEqual({ name: "commandPalette" });
    expect(dialog()).not.toBeNull();
  });

  it("opens from the main menu item", () => {
    act(() => {
      fireEvent.click(getByTestId(renderResult.container, "main-menu-trigger"));
    });
    act(() => {
      fireEvent.click(
        getByTestId(renderResult.container, "command-palette-button"),
      );
    });

    expect(h.state.openDialog).toEqual({ name: "commandPalette" });
    expect(dialog()).not.toBeNull();
  });

  it("closes on escape", () => {
    openPalette();
    expect(dialog()).not.toBeNull();

    act(() => {
      fireEvent.keyDown(input(), { key: KEYS.ESCAPE });
    });

    expect(h.state.openDialog).toBeNull();
    expect(dialog()).toBeNull();
  });

  it("lists the available categories and hides the unported commands", () => {
    openPalette();

    // nothing is selected, so the selection-gated commands stay hidden
    expect(labels()).not.toContain(t("labels.delete"));
    expect(labels()).not.toContain(t("labels.group"));
    for (const category of ["App", "Export", "Editor", "Tools"]) {
      expect(categoryTitles()).toContain(category);
    }
    expect(labels()).toContain(t("toolBar.rectangle"));
    expect(labels()).toContain(t("buttons.exportImage"));
    expect(labels()).toContain(t("toolBar.library"));

    for (const gated of [
      t("buttons.zenMode"),
      t("buttons.objectsSnapMode"),
      t("labels.toggleGrid"),
      t("stats.fullTitle"),
      t("labels.textToDiagram"),
      t("toolBar.mermaidToExcalidraw"),
      t("labels.shapeSwitch"),
      t("labels.copyAsPng"),
      t("labels.copyAsSvg"),
      t("labels.copyStyles"),
      t("labels.pasteStyles"),
      t("labels.alignTop"),
      t("labels.wrapSelectionInFrame"),
    ]) {
      expect(labels()).not.toContain(gated);
    }
  });

  it("shows the element commands once something is selected", () => {
    API.setElements([API.createElement({ type: "rectangle" })]);
    API.setAppState({ selectedElementIds: { [h.elements[0].id]: true } });

    openPalette();

    expect(categoryTitles()).toContain("Elements");
    expect(labels()).toContain(t("labels.delete"));
  });

  it("filters with a fuzzy query", () => {
    filter("darkmo");

    expect(labels()).toContain(t("buttons.darkMode"));
    expect(labels()).not.toContain(t("toolBar.rectangle"));
  });

  it("shows the no-match message for a query without results", () => {
    filter("zzzzzz");

    expect(items()).toHaveLength(0);
    expect(
      renderResult.container.querySelector(".command-palette-dialog .no-match"),
    ).not.toBeNull();
  });

  it("moves the highlight with the arrow keys", () => {
    filter("zoom");

    const shown = labels();
    expect(shown.length).toBeGreaterThan(1);
    expect(items()[0].classList).toContain("item-selected");

    act(() => {
      Keyboard.keyDown(KEYS.ARROW_DOWN, input());
    });
    expect(items()[1].classList).toContain("item-selected");
    expect(items()[0].classList).not.toContain("item-selected");

    act(() => {
      Keyboard.keyDown(KEYS.ARROW_UP, input());
    });
    expect(items()[0].classList).toContain("item-selected");

    // wraps around to the last item
    act(() => {
      Keyboard.keyDown(KEYS.ARROW_UP, input());
    });
    expect(items()[shown.length - 1].classList).toContain("item-selected");
  });

  it("executes the clicked command", () => {
    const zoom = h.state.zoom.value;

    filter("zoomin");
    expect(labels()[0]).toBe(t("buttons.zoomIn"));

    act(() => {
      fireEvent.click(items()[0]);
    });

    expect(h.state.zoom.value).toBeGreaterThan(zoom);
    expect(h.state.openDialog).toBeNull();
    expect(dialog()).toBeNull();
  });

  it("executes the highlighted command on enter", async () => {
    expect(h.state.theme).toBe(THEME.LIGHT);

    filter("darkmo");

    act(() => {
      Keyboard.keyDown(KEYS.ENTER, input());
    });

    await waitFor(() => {
      expect(h.state.theme).toBe(THEME.DARK);
    });
    expect(h.state.openDialog).toBeNull();
  });

  /** upstream keeps the recent item in a module-level atom, so this opening
   * has to make its own */
  it("keeps the executed command in the recents section", () => {
    filter("zoomin");
    act(() => {
      fireEvent.click(items()[0]);
    });

    openPalette();

    expect(categoryTitles()[0]).toBe(t("commandPalette.recents"));
    expect(labels()[0]).toBe(t("buttons.zoomIn"));
  });

  it("hints at the palette shortcut on CtrlOrCmd+P", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.P);
    });

    expect(h.state.toast?.message).toContain(t("commandPalette.title"));
    expect(
      renderResult.container.querySelector(".Toast .Toast__message")
        ?.textContent,
    ).toBe(h.state.toast?.message);
  });

  it("toggles the library sidebar from the app command", () => {
    filter("library");

    act(() => {
      fireEvent.click(items()[0]);
    });

    expect(h.state.openSidebar).toEqual({
      name: DEFAULT_SIDEBAR.name,
      tab: DEFAULT_SIDEBAR.defaultTab,
    });
  });

  it("lists named library items in the Library category while searching", async () => {
    await act(() =>
      h.app.library.updateLibrary({
        libraryItems: [
          {
            id: "item1",
            status: "unpublished",
            created: 1,
            name: "zigzag",
            elements: [API.createElement({ id: "elem1", type: "rectangle" })],
          },
          {
            id: "item2",
            status: "unpublished",
            created: 2,
            elements: [API.createElement({ id: "elem2", type: "ellipse" })],
          },
        ],
      }),
    );

    // a single character is below the library-command threshold
    filter("z");
    expect(categoryTitles()).not.toContain("Library");

    act(() => {
      updateTextEditor(input(), "zigzag");
    });

    expect(categoryTitles()).toContain("Library");
    expect(labels()).toContain("zigzag");
    // the unnamed item never becomes a command
    expect(items()).toHaveLength(1);
    expect(
      renderResult.container.querySelector(
        ".command-item-large .library-item-icon",
      ),
    ).not.toBeNull();
  });

  it("inserts the library item of the executed Library command", async () => {
    await act(() =>
      h.app.library.updateLibrary({
        libraryItems: [
          {
            id: "item1",
            status: "unpublished",
            created: 1,
            name: "zigzag",
            elements: [API.createElement({ id: "elem1", type: "rectangle" })],
          },
        ],
      }),
    );

    filter("zigzag");
    expect(labels()).toEqual(["zigzag"]);

    act(() => {
      fireEvent.click(items()[0]);
    });

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].type).toBe("rectangle");
    });
  });

  it("documents the shortcut in the help dialog", () => {
    act(() => {
      fireEvent.click(getByTestId(renderResult.container, "main-menu-trigger"));
    });
    act(() => {
      fireEvent.click(getByTestId(renderResult.container, "help-menu-item"));
    });

    const rows = Array.from(
      renderResult.container.querySelectorAll(".HelpDialog__shortcut"),
    ).map((row) => row.textContent);

    expect(rows.some((row) => row?.includes(t("commandPalette.title")))).toBe(
      true,
    );
  });
});
