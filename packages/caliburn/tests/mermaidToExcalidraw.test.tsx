import React from "react";

import { KEYS } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { Excalidraw } from "../src/index";

import { mockMermaidToExcalidraw } from "./helpers/mocks";
import { Keyboard } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, waitFor } from "./test-utils";

import type { RenderResult } from "./test-utils";

const { h } = window;

// ported verbatim from upstream `tests/MermaidToExcalidraw.test.tsx`; the
// `@codemirror/*` + `@lezer/highlight` module mocks upstream needs to force
// `TTDDialogInput` onto its `<textarea>` fallback have no caliburn
// counterpart — caliburn only ports that fallback branch
mockMermaidToExcalidraw({
  parseMermaidToExcalidraw: async (definition) => {
    const firstLine = definition.split("\n")[0];
    return new Promise((resolve, reject) => {
      if (firstLine === "flowchart TD") {
        resolve({
          elements: [
            {
              id: "Start",
              type: "rectangle",
              groupIds: [],
              x: 0,
              y: 0,
              width: 69.703125,
              height: 44,
              strokeWidth: 2,
              label: {
                groupIds: [],
                text: "Start",
                fontSize: 20,
              },
              link: null,
            },
            {
              id: "Stop",
              type: "rectangle",
              groupIds: [],
              x: 2.7109375,
              y: 94,
              width: 64.28125,
              height: 44,
              strokeWidth: 2,
              label: {
                groupIds: [],
                text: "Stop",
                fontSize: 20,
              },
              link: null,
            },
            {
              id: "Start_Stop",
              type: "arrow",
              groupIds: [],
              x: 34.852,
              y: 44,
              strokeWidth: 2,
              points: [
                [0, 0],
                [0, 50],
              ],
              roundness: {
                type: 2,
              },
              start: {
                id: "Start",
              },
              end: {
                id: "Stop",
              },
            },
          ],
        });
      } else {
        reject(new Error("ERROR"));
      }
    });
  },
});

const INPUT_SELECTOR = ".ttd-dialog-input";

const dialog = () => document.querySelector(".ttd-dialog");

const previewCanvas = () =>
  document.querySelector(".ttd-dialog-output-canvas-content canvas");

const errorOverlay = () =>
  document.querySelector('[data-testid="ttd-dialog-output-error"]');

/** the extra-tools dropdown item upstream labels "Mermaid to Excalidraw" */
const mermaidToolbarItem = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '[data-testid="toolbar-embeddable"]',
    ),
  ).find((item) =>
    item.textContent?.includes(t("toolBar.mermaidToExcalidraw")),
  );

const waitForPreview = () =>
  waitFor(() => {
    act(() => {});
    expect(previewCanvas()).not.toBeNull();
  });

let renderResult: RenderResult;

beforeEach(() => {
  localStorage.clear();
});

describe("Test <MermaidToExcalidraw/>", () => {
  beforeEach(async () => {
    renderResult = await render(
      <Excalidraw
        initialData={{
          appState: {
            openDialog: { name: "ttd", tab: "mermaid" },
          },
        }}
      />,
    );
  });

  it("should open mermaid popup when active tool is mermaid", async () => {
    expect(dialog()).not.toBeNull();
    await waitForPreview();
    expect(dialog()!.outerHTML).toMatchSnapshot();
  });

  it("should show error in preview when mermaid library throws error", async () => {
    expect(dialog()).not.toBeNull();

    const editor = await getTextEditor({
      selector: INPUT_SELECTOR,
      waitForEditor: true,
    });

    expect(errorOverlay()).toBeNull();
    expect(editor.value).toMatchSnapshot();

    act(() => {
      updateTextEditor(editor, "flowchart TD1");
    });

    expect(
      (await getTextEditor({ selector: INPUT_SELECTOR, waitForEditor: false }))
        .value,
    ).toBe("flowchart TD1");

    await waitFor(() => {
      act(() => {});
      expect(errorOverlay()).not.toBeNull();
    });
  });
});

describe("mermaid dialog entry points", () => {
  beforeEach(async () => {
    renderResult = await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("opens from the toolbar's extra-tools dropdown and inserts the diagram", async () => {
    expect(dialog()).toBeNull();

    fireEvent.click(
      renderResult.container.querySelector(
        ".App-toolbar__extra-tools-trigger",
      )!,
    );
    fireEvent.click(mermaidToolbarItem()!);

    expect(h.state.openDialog).toEqual({ name: "ttd", tab: "mermaid" });
    expect(dialog()).not.toBeNull();

    await waitForPreview();

    expect(h.elements.length).toBe(0);

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(".ttd-dialog-panel-button")!,
    );

    expect(h.elements.map((element) => element.type)).toEqual(
      expect.arrayContaining(["rectangle", "text", "arrow"]),
    );
    expect(h.state.openDialog).toBeNull();
    expect(dialog()).toBeNull();
  });

  it("inserts with the CtrlOrCmd+Enter shortcut", async () => {
    fireEvent.click(
      renderResult.container.querySelector(
        ".App-toolbar__extra-tools-trigger",
      )!,
    );
    fireEvent.click(mermaidToolbarItem()!);
    await waitForPreview();

    const editor = await getTextEditor({
      selector: INPUT_SELECTOR,
      waitForEditor: false,
    });

    fireEvent.keyDown(editor, {
      key: KEYS.ENTER,
      [KEYS.CTRL_OR_CMD]: true,
    });

    expect(h.elements.length).toBeGreaterThan(0);
    expect(h.state.openDialog).toBeNull();
  });

  it("opens from the command palette", async () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.SLASH);
    });

    const command = Array.from(
      renderResult.container.querySelectorAll<HTMLElement>(".command-item"),
    ).find(
      (item) =>
        item.querySelector(".name")?.textContent?.trim() ===
        `${t("toolBar.mermaidToExcalidraw")}...`,
    );

    expect(command).not.toBeUndefined();

    fireEvent.click(command!);

    expect(h.state.openDialog).toEqual({ name: "ttd", tab: "mermaid" });
    await waitForPreview();
  });
});
