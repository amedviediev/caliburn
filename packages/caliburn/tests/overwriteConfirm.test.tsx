import React from "react";

import { MIME_TYPES } from "@excalidraw/common";

import * as filesystemModule from "@excalidraw/excalidraw/data/filesystem";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { t } from "@excalidraw/excalidraw/i18n";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { act, fireEvent, getByTestId, render, waitFor } from "./test-utils";

import type { RenderResult } from "./test-utils";

let renderResult: RenderResult;

const openMainMenu = () => {
  fireEvent.click(getByTestId(renderResult.container, "main-menu-trigger"));
};

const clickLoad = () => {
  openMainMenu();
  act(() => {
    fireEvent.click(getByTestId(renderResult.container, "load-button"));
  });
};

const mockLoadedScene = () =>
  vi
    .spyOn(filesystemModule, "fileOpen")
    .mockResolvedValue(
      new File(
        [
          serializeAsJSON(
            [API.createElement({ type: "ellipse", id: "loaded" })],
            h.state,
            {},
            "local",
          ),
        ],
        "scene.excalidraw",
        { type: MIME_TYPES.excalidraw },
      ) as any,
    );

const queryOverwriteConfirm = () =>
  renderResult.container.querySelector<HTMLElement>(".OverwriteConfirm");

describe("overwrite confirmation", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    renderResult = await render(<Excalidraw />);
  });

  it("loads straight away when the scene is empty", async () => {
    const fileOpenSpy = mockLoadedScene();

    clickLoad();

    await waitFor(() => {
      expect(h.elements.map((element) => element.id)).toEqual(["loaded"]);
    });
    expect(queryOverwriteConfirm()).toBeNull();
    expect(fileOpenSpy).toHaveBeenCalledTimes(1);
  });

  it("asks first when the scene has content", async () => {
    mockLoadedScene();
    API.setElements([API.createElement({ type: "rectangle", id: "existing" })]);

    clickLoad();

    const dialog = await waitFor(() => {
      const dialog = queryOverwriteConfirm();
      expect(dialog).not.toBeNull();
      return dialog!;
    });

    expect(dialog.querySelector("h3")!.textContent).toBe(
      t("overwriteConfirm.modal.loadFromFile.title"),
    );
    // upstream renders the description through `<Trans>`, which turns the
    // string's `<bold>` marker into a `<strong>`
    expect(dialog.querySelector("strong")!.textContent).toBe(
      "replace your existing content",
    );
    expect(
      dialog.querySelector(".OverwriteConfirm__Description")!.classList,
    ).toContain("OverwriteConfirm__Description--color-warning");
    expect(
      Array.from(dialog.querySelectorAll(".OverwriteConfirm__Actions h4")).map(
        (heading) => heading.textContent,
      ),
    ).toEqual([
      t("overwriteConfirm.action.saveToDisk.title"),
      t("overwriteConfirm.action.exportToImage.title"),
    ]);
    expect(h.elements.map((element) => element.id)).toEqual(["existing"]);
  });

  it("loads on confirm", async () => {
    const fileOpenSpy = mockLoadedScene();
    API.setElements([API.createElement({ type: "rectangle", id: "existing" })]);

    clickLoad();

    const confirmButton = await waitFor(() => {
      const button = renderResult.container.querySelector<HTMLButtonElement>(
        ".OverwriteConfirm__Description .ExcButton",
      );
      expect(button).not.toBeNull();
      return button!;
    });
    expect(confirmButton.getAttribute("aria-label")).toBe(
      t("overwriteConfirm.modal.loadFromFile.button"),
    );

    act(() => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(h.elements.map((element) => element.id)).toEqual(["loaded"]);
    });
    expect(queryOverwriteConfirm()).toBeNull();
    expect(fileOpenSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the scene when the modal is dismissed", async () => {
    const fileOpenSpy = mockLoadedScene();
    API.setElements([API.createElement({ type: "rectangle", id: "existing" })]);

    clickLoad();

    const backdrop = await waitFor(() => {
      const backdrop = renderResult.container.querySelector<HTMLElement>(
        ".Dialog .Modal__background",
      );
      expect(backdrop).not.toBeNull();
      return backdrop!;
    });

    act(() => {
      fireEvent.click(backdrop);
    });

    await waitFor(() => {
      expect(queryOverwriteConfirm()).toBeNull();
    });
    expect(h.elements.map((element) => element.id)).toEqual(["existing"]);
    expect(fileOpenSpy).not.toHaveBeenCalled();
  });
});
