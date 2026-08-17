import React from "react";
import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";

import { createPasteEvent } from "@excalidraw/excalidraw/clipboard";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { Keyboard } from "./helpers/ui";
import { act, render, waitFor, GlobalTestState } from "./test-utils";

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();

  return {
    __esmodule: true,
    ...module,
    isDarwin: false,
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
  };
});

/** two columns → bar and line are valid, radar is not (it needs 3 dimensions) */
const TWO_COLUMN_TSV = "a\tb\n1\t2\n3\t4";

/** the radar fixture from `charts.test.tsx` — 5 dimensions, 3 series */
const RADAR_CSV = `Metric,Player A,Player B,Player C
Speed,80,60,75
Strength,65,85,70
Agility,90,70,88
Intelligence,70,88,92
Stamina,85,75,80`;

const sendPasteEvent = (text: string) => {
  document.dispatchEvent(createPasteEvent({ types: { "text/plain": text } }));
};

const pasteWithCtrlCmdV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.V);
    sendPasteEvent(text);
  });
};

const pasteWithCtrlCmdShiftV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
    Keyboard.keyPress(KEYS.V);
    sendPasteEvent(text);
  });
};

// the dialog is a `Modal`, so it renders into the body-level
// `.excalidraw-modal-container` portal; `.PasteChartDialog` lands both on the
// `caliburn-dialog` host and on the `.Modal` root it routes the class to
const queryDialog = () =>
  document.querySelector<HTMLElement>(".Modal.PasteChartDialog");

const queryPreviews = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".Modal.PasteChartDialog button.ChartPreview",
    ),
  );

const previewByLabel = (label: string) =>
  queryPreviews().find(
    (preview) => preview.getAttribute("aria-label") === label,
  );

const waitForDialog = async () => {
  await waitFor(() => {
    act(() => {});
    expect(queryDialog()).not.toBeNull();
  });
  return queryDialog()!;
};

const waitForPreviewSvg = async (preview: HTMLButtonElement) => {
  await waitFor(() => {
    act(() => {});
    expect(preview.querySelector(".ChartPreview__canvas svg")).not.toBeNull();
  });
  return preview.querySelector("svg")!;
};

/** presses `key` on the reshuffle affordance and waits for `preview` to swap
 * the svg it was showing, returning the new one */
const reshuffleWithKey = async (
  reshuffle: HTMLElement,
  preview: HTMLButtonElement,
  previous: SVGSVGElement,
  key: string,
) => {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    reshuffle.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(true);

  await waitFor(() => {
    act(() => {});
    expect(preview.querySelector("svg")).not.toBe(previous);
    expect(preview.querySelector("svg")).not.toBeNull();
  });
  return preview.querySelector("svg")!;
};

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
});

describe("pasting a spreadsheet", () => {
  it("opens the chart dialog instead of pasting the text", async () => {
    pasteWithCtrlCmdV(TWO_COLUMN_TSV);

    await waitForDialog();

    expect(h.elements).toHaveLength(0);
    expect(h.state.openDialog).toEqual({
      name: "charts",
      rawText: TWO_COLUMN_TSV,
      data: {
        title: "b",
        labels: ["1", "3"],
        series: [{ title: "b", values: [2, 4] }],
      },
    });
  });

  it("renders a preview per valid chart type plus the plain text one", async () => {
    pasteWithCtrlCmdV(TWO_COLUMN_TSV);
    await waitForDialog();

    expect(
      queryPreviews().map((preview) => preview.getAttribute("aria-label")),
    ).toEqual([
      t("labels.chartType_bar"),
      t("labels.chartType_line"),
      t("labels.chartType_plaintext"),
    ]);
  });

  it("offers the radar chart when the data has enough dimensions", async () => {
    pasteWithCtrlCmdV(RADAR_CSV);
    await waitForDialog();

    expect(
      queryPreviews().map((preview) => preview.getAttribute("aria-label")),
    ).toEqual([
      t("labels.chartType_bar"),
      t("labels.chartType_line"),
      t("labels.chartType_radar"),
      t("labels.chartType_plaintext"),
    ]);
  });

  it("renders each preview as an svg", async () => {
    pasteWithCtrlCmdV(TWO_COLUMN_TSV);
    await waitForDialog();

    for (const preview of queryPreviews()) {
      await waitForPreviewSvg(preview);
    }
  });

  it("inserts the chart on click, closes, and undoes in one step", async () => {
    pasteWithCtrlCmdV(TWO_COLUMN_TSV);
    await waitForDialog();

    const bar = previewByLabel(t("labels.chartType_bar"))!;
    await waitForPreviewSvg(bar);

    act(() => {
      bar.click();
    });

    expect(h.elements.length).toBeGreaterThan(0);
    expect(new Set(h.elements.map((element) => element.type))).toContain(
      "rectangle",
    );
    expect(h.state.openDialog).toBe(null);
    expect(queryDialog()).toBe(null);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(0);
  });

  it("inserts the raw text on the plain text preview", async () => {
    // the comma fixture, so the assertion isn't fighting the tab expansion
    // `newTextElement` does to a TSV
    pasteWithCtrlCmdV(RADAR_CSV);
    await waitForDialog();

    const plaintext = previewByLabel(t("labels.chartType_plaintext"))!;

    act(() => {
      plaintext.click();
    });

    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].type).toBe("text");
    expect((h.elements[0] as ExcalidrawTextElement).text).toBe(RADAR_CSV);
    expect(h.state.openDialog).toBe(null);
  });

  it("re-renders the previews when the colors are reshuffled", async () => {
    pasteWithCtrlCmdV(TWO_COLUMN_TSV);
    const dialog = await waitForDialog();

    const bar = previewByLabel(t("labels.chartType_bar"))!;
    const before = await waitForPreviewSvg(bar);

    const reshuffle = dialog.querySelector<HTMLElement>(
      ".PasteChartDialog__reshuffleBtn",
    )!;
    act(() => {
      reshuffle.click();
    });

    await waitFor(() => {
      act(() => {});
      expect(bar.querySelector("svg")).not.toBe(before);
      expect(bar.querySelector("svg")).not.toBeNull();
    });
  });

  it("reshuffles on Enter and Space, and blocks the key's default", async () => {
    pasteWithCtrlCmdV(TWO_COLUMN_TSV);
    const dialog = await waitForDialog();

    const bar = previewByLabel(t("labels.chartType_bar"))!;
    const before = await waitForPreviewSvg(bar);

    const reshuffle = dialog.querySelector<HTMLElement>(
      ".PasteChartDialog__reshuffleBtn",
    )!;
    expect(reshuffle.getAttribute("role")).toBe("button");
    expect(reshuffle.getAttribute("tabindex")).toBe("0");

    const afterEnter = await reshuffleWithKey(
      reshuffle,
      bar,
      before,
      KEYS.ENTER,
    );
    await reshuffleWithKey(reshuffle, bar, afterEnter, KEYS.SPACE);
  });

  it("closes on Escape without inserting anything", async () => {
    pasteWithCtrlCmdV(TWO_COLUMN_TSV);
    const dialog = await waitForDialog();

    act(() => {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: KEYS.ESCAPE,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(h.state.openDialog).toBe(null);
    expect(queryDialog()).toBe(null);
    expect(h.elements).toHaveLength(0);
  });

  it("pastes as text on a plain (shift) paste", async () => {
    pasteWithCtrlCmdShiftV(TWO_COLUMN_TSV);

    await waitFor(() => {
      expect(h.elements).toHaveLength(1);
    });
    expect(h.elements[0].type).toBe("text");
    expect(h.state.openDialog).toBe(null);
    expect(queryDialog()).toBe(null);
  });
});

describe("pasting a spreadsheet with the default UI off", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(
      <Excalidraw autoFocus={true} handleKeyboardGlobally={true} ui={false} />,
    );
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  it("records the open dialog but renders none of it", async () => {
    pasteWithCtrlCmdV(TWO_COLUMN_TSV);

    await waitFor(() => {
      act(() => {});
      expect(h.state.openDialog?.name).toBe("charts");
    });
    expect(queryDialog()).toBe(null);
    expect(queryPreviews()).toHaveLength(0);
  });
});
