import React from "react";

import { KEYS, THEME } from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  fireEvent,
  getByTestId,
  queryByTestId,
  render,
} from "./test-utils";

import type { RenderResult } from "./test-utils";

let renderResult: RenderResult;

const openMainMenu = () => {
  fireEvent.click(getByTestId(renderResult.container, "main-menu-trigger"));
};

beforeEach(async () => {
  localStorage.clear();
  renderResult = await render(<Excalidraw />);
});

describe("MainMenu", () => {
  it("renders the trigger and opens the default items", () => {
    const { container } = renderResult;

    expect(container.querySelector(".main-menu-trigger")).not.toBeNull();
    expect(queryByTestId(container, "dropdown-menu")).toBeNull();

    openMainMenu();

    const menu = queryByTestId(container, "dropdown-menu");
    expect(menu).not.toBeNull();
    expect(menu!.classList).toContain("main-menu");

    for (const testId of [
      "load-button",
      "json-export-button",
      "image-export-button",
      "search-menu-button",
      "help-menu-item",
      "clear-canvas-button",
      "toggle-dark-mode",
      "canvas-background-label",
    ]) {
      expect(queryByTestId(container, testId)).not.toBeNull();
    }

    // save-to-active-file has no file handle yet, so its action is disabled
    expect(queryByTestId(container, "save-button")).toBeNull();
  });

  it("closes when a regular item is selected", () => {
    openMainMenu();
    expect(h.state.openMenu).toBe("canvas");

    act(() => {
      fireEvent.click(getByTestId(renderResult.container, "help-menu-item"));
    });

    expect(h.state.openMenu).toBe(null);
  });

  it("closes on an outside pointerdown", () => {
    openMainMenu();
    expect(h.state.openMenu).toBe("canvas");

    act(() => {
      fireEvent.pointerDown(document.body);
    });

    expect(h.state.openMenu).toBe(null);
    expect(queryByTestId(renderResult.container, "dropdown-menu")).toBeNull();
  });

  it("keeps the menu open when toggling the theme", () => {
    openMainMenu();

    act(() => {
      fireEvent.click(getByTestId(renderResult.container, "toggle-dark-mode"));
    });

    expect(h.state.theme).toBe(THEME.DARK);
    expect(h.state.openMenu).toBe("canvas");
  });

  it("changes the canvas background from the top picks", () => {
    openMainMenu();

    const swatch = renderResult.container.querySelector<HTMLButtonElement>(
      '[data-testid^="color-top-pick-"]:not([data-testid="color-top-pick-#ffffff"])',
    )!;
    expect(swatch).not.toBeNull();

    act(() => {
      fireEvent.click(swatch);
    });

    expect(h.state.viewBackgroundColor).toBe(
      swatch.getAttribute("data-testid")!.replace("color-top-pick-", ""),
    );
  });
});

describe("HelpDialog", () => {
  it("opens from the menu and closes on escape", () => {
    const { container } = renderResult;

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "help-menu-item"));
    });

    expect(h.state.openDialog).toEqual({ name: "help" });
    const dialog = container.querySelector(".Modal.HelpDialog")!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelectorAll(".HelpDialog__island").length).toBe(3);
    expect(
      dialog.querySelectorAll("kbd.HelpDialog__key").length,
    ).toBeGreaterThan(0);

    act(() => {
      fireEvent.keyDown(dialog, { key: KEYS.ESCAPE });
    });

    expect(h.state.openDialog).toBe(null);
    expect(container.querySelector(".Modal.HelpDialog")).toBeNull();
  });

  it("opens via the ? shortcut and toggles back off", () => {
    act(() => {
      Keyboard.keyDown("?");
    });
    expect(h.state.openDialog).toEqual({ name: "help" });

    act(() => {
      Keyboard.keyDown("?");
    });
    expect(h.state.openDialog).toBe(null);
  });
});

describe("ClearCanvas confirm dialog", () => {
  it("clears the scene once confirmed", () => {
    const { container } = renderResult;

    API.setElements([API.createElement({ type: "rectangle" })]);
    expect(h.elements.length).toBe(1);

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "clear-canvas-button"));
    });

    const dialog = container.querySelector(".confirm-dialog")!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector(".clear-canvas__content")).not.toBeNull();

    const [cancel, confirm] = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>(
        ".confirm-dialog-buttons button",
      ),
    );
    expect(confirm.classList).toContain("Dialog__action-button--danger");

    act(() => {
      fireEvent.click(cancel);
    });
    expect(container.querySelector(".confirm-dialog")).toBeNull();
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(1);

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "clear-canvas-button"));
    });
    act(() => {
      fireEvent.click(
        container.querySelectorAll<HTMLButtonElement>(
          ".confirm-dialog-buttons button",
        )[1],
      );
    });

    expect(container.querySelector(".confirm-dialog")).toBeNull();
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(0);
  });
});

describe("ErrorDialog", () => {
  it("renders appState.errorMessage and clears it on close", () => {
    const { container } = renderResult;

    act(() => {
      API.setAppState({ errorMessage: "boom" });
    });

    const dialog = container.querySelector(".Modal")!;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain("boom");

    act(() => {
      fireEvent.keyDown(dialog, { key: KEYS.ESCAPE });
    });

    expect(h.state.errorMessage).toBe(null);
    expect(container.querySelector(".Modal")).toBeNull();
  });
});

describe("JSONExportDialog", () => {
  it("opens from the menu and renders the save-to-disk card", () => {
    const { container } = renderResult;

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "json-export-button"));
    });

    expect(h.state.openDialog).toEqual({ name: "jsonExport" });
    const dialog = container.querySelector(".ExportDialog--json")!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelectorAll(".Card").length).toBe(1);
    expect(dialog.querySelector(".Card-button")).not.toBeNull();

    act(() => {
      fireEvent.keyDown(container.querySelector(".Modal")!, {
        key: KEYS.ESCAPE,
      });
    });
    expect(h.state.openDialog).toBe(null);
  });
});

describe("ImageExportDialog", () => {
  it("opens from the menu with the export settings and buttons", () => {
    const { container } = renderResult;

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "image-export-button"));
    });

    expect(h.state.openDialog).toEqual({ name: "imageExport" });
    const modal = container.querySelector(".ImageExportModal")!;
    expect(modal).not.toBeNull();
    expect(
      modal.querySelector(".ImageExportModal__preview__canvas"),
    ).not.toBeNull();

    for (const name of [
      "exportBackgroundSwitch",
      "exportDarkModeSwitch",
      "exportEmbedSwitch",
    ]) {
      expect(modal.querySelector(`input#${name}`)).not.toBeNull();
    }
    expect(modal.querySelectorAll('input[name="exportScale"]').length).toBe(3);
    expect(
      modal.querySelectorAll(".ImageExportModal__settings__buttons__button")
        .length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("routes the setting switches through the export actions", () => {
    const { container } = renderResult;

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "image-export-button"));
    });

    expect(h.state.exportBackground).toBe(true);
    act(() => {
      fireEvent.click(container.querySelector("input#exportBackgroundSwitch")!);
    });
    expect(h.state.exportBackground).toBe(false);

    expect(h.state.exportEmbedScene).toBe(false);
    act(() => {
      fireEvent.click(container.querySelector("input#exportEmbedSwitch")!);
    });
    expect(h.state.exportEmbedScene).toBe(true);

    expect(h.state.exportScale).toBe(1);
    act(() => {
      fireEvent.click(
        container.querySelectorAll<HTMLInputElement>(
          'input[name="exportScale"]',
        )[2],
      );
    });
    expect(h.state.exportScale).toBe(3);
  });
});
