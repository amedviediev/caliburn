import React from "react";

import { DEFAULT_ELEMENT_STROKE_PICKS } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { act, fireEvent, render, unmountComponent } from "./test-utils";

import type { RenderResult } from "./test-utils";

const { h } = window;

unmountComponent();

let renderResult: RenderResult;

/** the stroke picker's strip — the first of the two in the shape panel */
const strip = () =>
  renderResult.container.querySelector<HTMLElement>(
    ".color-picker__top-picks",
  )!;

const picks = () =>
  Array.from(
    strip().querySelectorAll<HTMLButtonElement>("[data-top-pick-index]"),
  );

const contextMenu = () =>
  renderResult.container.querySelector<HTMLElement>(
    ".color-picker__context-menu",
  );

const ghost = () =>
  document.body.querySelector<HTMLElement>(".excalidraw-color-dnd-ghost");

const rectFor = (index: number) =>
  ({
    left: index * 30,
    right: index * 30 + 24,
    top: 0,
    bottom: 24,
    width: 24,
    height: 24,
    x: index * 30,
    y: 0,
    toJSON: () => {},
  } as DOMRect);

/** jsdom lays nothing out — stub the strip geometry the hit test reads */
const stubStripGeometry = () => {
  const buttons = picks();
  buttons.forEach((button, index) => {
    button.getBoundingClientRect = () => rectFor(index);
  });
  strip().getBoundingClientRect = () =>
    ({
      left: 0,
      right: buttons.length * 30,
      top: 0,
      bottom: 24,
      width: buttons.length * 30,
      height: 24,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);
};

const dragPickTo = async (fromIndex: number, clientX: number) => {
  const source = picks()[fromIndex];
  stubStripGeometry();

  act(() => {
    fireEvent.pointerDown(source, {
      pointerId: 1,
      button: 0,
      clientX: fromIndex * 30 + 12,
      clientY: 12,
    });
  });

  // outrun the 100ms activation grace period
  await new Promise((resolve) => setTimeout(resolve, 120));

  act(() => {
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX,
      clientY: 12,
    });
  });

  return source;
};

describe("color top picks drag & drop", () => {
  beforeEach(async () => {
    renderResult = await render(<Excalidraw handleKeyboardGlobally={true} />);
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    act(() => {
      API.setAppState({ selectedElementIds: { [rectangle.id]: true } });
    });
  });

  afterEach(() => {
    ghost()?.remove();
    document.body.classList.remove("excalidraw-color-dnd-active");
  });

  it("renders the strip with drag handles", () => {
    expect(picks()).toHaveLength(DEFAULT_ELEMENT_STROKE_PICKS.length);
    expect(picks()[0].dataset.topPickIndex).toBe("0");
  });

  it("reorders picks by dragging one onto another slot", async () => {
    const initial = picks().map((button) => button.title);

    await dragPickTo(0, 12 + 30 * 2);

    expect(ghost()).not.toBeNull();
    expect(document.body.classList).toContain("excalidraw-color-dnd-active");

    act(() => {
      fireEvent.pointerUp(window, {
        pointerId: 1,
        clientX: 12 + 30 * 2,
        clientY: 12,
      });
    });

    const expected = [...initial];
    const [moved] = expected.splice(0, 1);
    expected.splice(2, 0, moved);

    expect(h.state.colorTopPicks.elementStroke).toEqual(expected);
    expect(picks().map((button) => button.title)).toEqual(expected);
  });

  it("cancels the drag on Escape without changing the picks", async () => {
    await dragPickTo(0, 12 + 30 * 2);
    expect(ghost()).not.toBeNull();

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(h.state.colorTopPicks.elementStroke).toBe(null);
  });

  it("resets customized picks from the strip context menu", async () => {
    await dragPickTo(0, 12 + 30 * 2);
    act(() => {
      fireEvent.pointerUp(window, {
        pointerId: 1,
        clientX: 12 + 30 * 2,
        clientY: 12,
      });
    });
    expect(h.state.colorTopPicks.elementStroke).not.toBe(null);

    // the drop suppresses the click that would otherwise follow it
    await new Promise((resolve) => setTimeout(resolve, 120));

    act(() => {
      fireEvent.contextMenu(strip(), { clientX: 5, clientY: 5 });
    });

    const menu = contextMenu();
    expect(menu).not.toBeNull();

    act(() => {
      fireEvent.click(menu!.querySelector(".color-picker__context-menu-item")!);
    });

    expect(h.state.colorTopPicks.elementStroke).toBe(null);
    expect(contextMenu()).toBeNull();
    expect(picks().map((button) => button.title)).toEqual([
      ...DEFAULT_ELEMENT_STROKE_PICKS,
    ]);
  });

  it("keeps the reset item inert while the strip is untouched", () => {
    act(() => {
      fireEvent.contextMenu(strip(), { clientX: 5, clientY: 5 });
    });

    const item = contextMenu()!.querySelector<HTMLElement>(
      ".color-picker__context-menu-item",
    )!;
    expect(item.textContent?.trim()).toBe(t("colorPicker.resetTopPicks"));
    expect(item.dataset.disabled).toBe("");

    act(() => {
      fireEvent.click(item);
    });

    expect(contextMenu()).not.toBeNull();
  });
});
