import React from "react";

import {
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  KEYS,
  MIME_TYPES,
  THEME,
  applyDarkModeFilter,
} from "@excalidraw/common";

import * as filesystemModule from "@excalidraw/excalidraw/data/filesystem";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { t } from "@excalidraw/excalidraw/i18n";

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
  waitFor,
} from "./test-utils";

import type { RenderResult } from "./test-utils";

let renderResult: RenderResult;

const openMainMenu = () => {
  fireEvent.click(getByTestId(renderResult.container, "main-menu-trigger"));
};

const fileHandle = (name: string) =>
  ({ name } as unknown as FileSystemFileHandle);

/** jsdom's Blob has no `.text()`, so read it the way the vendored
 * `parseFileContents` does */
const readBlob = async (blob: Blob | Promise<Blob>) => {
  const resolved = await blob;
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(resolved);
  });
};

beforeEach(async () => {
  localStorage.clear();
  renderResult = await render(<Excalidraw />);
});

afterEach(() => {
  vi.restoreAllMocks();
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
      "command-palette-button",
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

  it("mirrors the upstream top-picks swatch contract", () => {
    openMainMenu();

    const swatches = Array.from(
      renderResult.container.querySelectorAll<HTMLButtonElement>(
        ".color-picker__top-picks .color-picker__button",
      ),
    );
    expect(swatches.length).toBe(DEFAULT_CANVAS_BACKGROUND_PICKS.length);

    swatches.forEach((swatch, index) => {
      const color = DEFAULT_CANVAS_BACKGROUND_PICKS[index];
      expect(swatch.getAttribute("type")).toBe("button");
      expect(swatch.getAttribute("title")).toBe(color);
      expect(swatch.getAttribute("data-testid")).toBe(
        `color-top-pick-${color}`,
      );
      expect(swatch.getAttribute("data-top-pick-index")).toBe(`${index}`);
      expect(swatch.style.getPropertyValue("--swatch-color")).toBe(color);
      // every default canvas-background pick is near-white, so upstream gives
      // all of them the contrast outline
      expect(swatch.classList).toContain("has-outline");
      expect(swatch.classList).not.toContain("is-transparent");
      expect(
        swatch.querySelector(".color-picker__button-outline"),
      ).not.toBeNull();
    });

    expect(swatches[0].classList).toContain("active");
    expect(swatches[1].classList).not.toContain("active");
  });

  it("dark-mode-filters the swatch colors", () => {
    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(renderResult.container, "toggle-dark-mode"));
    });
    expect(h.state.theme).toBe(THEME.DARK);

    const swatch = renderResult.container.querySelector<HTMLButtonElement>(
      ".color-picker__top-picks .color-picker__button",
    )!;
    const color = DEFAULT_CANVAS_BACKGROUND_PICKS[0];

    expect(swatch.style.getPropertyValue("--swatch-color")).toBe(
      applyDarkModeFilter(color, true),
    );
    expect(swatch.style.getPropertyValue("--swatch-color")).not.toBe(color);
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

describe("save / load / export actions", () => {
  it("saves the scene to disk from the JSON export dialog", async () => {
    const { container } = renderResult;

    API.setElements([API.createElement({ type: "rectangle", id: "rect-a" })]);
    act(() => {
      API.setAppState({ name: "my-scene" });
    });

    const saved = fileHandle("my-scene.excalidraw");
    const fileSaveSpy = vi
      .spyOn(filesystemModule, "fileSave")
      .mockResolvedValue(saved);

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "json-export-button"));
    });
    act(() => {
      fireEvent.click(
        container.querySelector<HTMLButtonElement>(".Card-button")!,
      );
    });

    await waitFor(() => {
      expect(h.state.fileHandle).toBe(saved);
    });

    expect(fileSaveSpy).toHaveBeenCalledTimes(1);
    const [blob, opts] = fileSaveSpy.mock.calls[0];
    expect(opts).toMatchObject({
      name: "my-scene",
      extension: "excalidraw",
      description: "Excalidraw file",
      fileHandle: null,
    });

    const serialized = JSON.parse(await readBlob(blob));
    expect(serialized.elements).toEqual([
      expect.objectContaining({ id: "rect-a" }),
    ]);
    expect(serialized.files).toEqual({});

    expect(h.state.openDialog).toBe(null);
    expect(h.state.toast?.message).toBe(t("toast.fileSaved"));
  });

  it("saves to the active file from the menu", async () => {
    const { container } = renderResult;

    API.setElements([API.createElement({ type: "rectangle", id: "rect-b" })]);
    const existing = fileHandle("scene.excalidraw");
    act(() => {
      API.setAppState({ name: "my-scene", fileHandle: existing });
    });

    const saved = fileHandle("saved.excalidraw");
    const fileSaveSpy = vi
      .spyOn(filesystemModule, "fileSave")
      .mockResolvedValue(saved);

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "save-button"));
    });

    await waitFor(() => {
      expect(h.state.fileHandle).toBe(saved);
    });

    // the existing (non-image) handle is reused rather than prompting anew
    expect(fileSaveSpy.mock.calls[0][1]).toMatchObject({
      name: "my-scene",
      extension: "excalidraw",
      fileHandle: existing,
    });
    expect(
      JSON.parse(await readBlob(fileSaveSpy.mock.calls[0][0])).elements,
    ).toEqual([expect.objectContaining({ id: "rect-b" })]);
    expect(h.state.toast?.message).toBe(
      t("toast.fileSavedToFilename").replace(
        "{filename}",
        '"saved.excalidraw"',
      ),
    );
  });

  it("replaces the scene from a loaded file", async () => {
    const { container } = renderResult;

    API.setElements([API.createElement({ type: "rectangle", id: "existing" })]);

    const json = serializeAsJSON(
      [API.createElement({ type: "ellipse", id: "loaded" })],
      h.state,
      {},
      "local",
    );
    const fileOpenSpy = vi
      .spyOn(filesystemModule, "fileOpen")
      .mockResolvedValue(
        new File([json], "scene.excalidraw", {
          type: MIME_TYPES.excalidraw,
        }) as any,
      );

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "load-button"));
    });

    await waitFor(() => {
      expect(h.elements.map((element) => element.id)).toEqual(["loaded"]);
    });
    expect(fileOpenSpy).toHaveBeenCalledTimes(1);
  });

  it("surfaces a load failure through the error dialog", async () => {
    const { container } = renderResult;

    vi.spyOn(filesystemModule, "fileOpen").mockResolvedValue(
      new File(["not excalidraw"], "scene.excalidraw", {
        type: MIME_TYPES.excalidraw,
      }) as any,
    );

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "load-button"));
    });

    await waitFor(() => {
      expect(h.state.errorMessage).toBeTruthy();
    });
    expect(container.querySelector(".Modal")).not.toBeNull();
  });

  it("exports an svg through onExportImage", async () => {
    const { container } = renderResult;

    API.setElements([API.createElement({ type: "rectangle", id: "rect-c" })]);
    act(() => {
      API.setAppState({ name: "my-scene" });
    });

    const saved = fileHandle("my-scene.svg");
    const fileSaveSpy = vi
      .spyOn(filesystemModule, "fileSave")
      .mockResolvedValue(saved);

    openMainMenu();
    act(() => {
      fireEvent.click(getByTestId(container, "image-export-button"));
    });
    // embed the scene so the returned image handle is adopted, and so the
    // extension switches to `.excalidraw.svg` as upstream does
    act(() => {
      fireEvent.click(container.querySelector("input#exportEmbedSwitch")!);
    });
    act(() => {
      fireEvent.click(
        container.querySelectorAll<HTMLButtonElement>(
          ".ImageExportModal__settings__buttons__button",
        )[1],
      );
    });

    await waitFor(() => {
      expect(fileSaveSpy).toHaveBeenCalledTimes(1);
    });

    const [blob, opts] = fileSaveSpy.mock.calls[0];
    expect(opts).toMatchObject({
      name: "my-scene",
      extension: "excalidraw.svg",
      description: "Export to SVG",
    });
    expect(await readBlob(blob)).toContain("<svg");

    await waitFor(() => {
      expect(h.state.fileHandle).toBe(saved);
    });
  });
});
