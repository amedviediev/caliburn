import React from "react";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
  DEFAULT_ELEMENT_STROKE_PICKS,
} from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  getByTestId,
  queryByTestId,
  render,
  togglePopover,
} from "./test-utils";

import type { RenderResult } from "./test-utils";

let renderResult: RenderResult;

const container = () => renderResult.container;

const queryPicker = () =>
  container().querySelector<HTMLElement>(".color-picker-content");

const pressInPicker = (key: string, options: KeyboardEventInit = {}) => {
  act(() => {
    fireEvent.keyDown(queryPicker()!, { key, ...options });
  });
};

describe("color picker", () => {
  beforeEach(async () => {
    renderResult = await render(<Excalidraw handleKeyboardGlobally={true} />);
    UI.createElement("rectangle", { x: 0, y: 0 });
  });

  it("renders the top picks strip and the active-color trigger", () => {
    const picks = Array.from(
      container().querySelectorAll<HTMLButtonElement>(
        ".selected-shape-actions .color-picker__top-picks .color-picker__button",
      ),
    ).slice(0, DEFAULT_ELEMENT_STROKE_PICKS.length);

    expect(picks.map((pick) => pick.getAttribute("data-testid"))).toEqual(
      DEFAULT_ELEMENT_STROKE_PICKS.map((color) => `color-top-pick-${color}`),
    );

    const trigger = container().querySelector<HTMLButtonElement>(
      '[data-openpopup="elementStroke"]',
    )!;
    expect(trigger.classList).toContain("color-picker__button");
    expect(trigger.classList).toContain("active-color");
    expect(trigger.classList).toContain("properties-trigger");
    // #1e1e1e is dark, so no contrast outline
    expect(trigger.classList).not.toContain("has-outline");
    expect(trigger.getAttribute("aria-label")).toBe("Stroke");
  });

  it("opens the full picker from the panel and toggles it back closed", () => {
    expect(queryPicker()).toBeNull();

    togglePopover("Stroke");
    expect(h.state.openPopup).toBe("elementStroke");

    const picker = queryPicker()!;
    expect(picker).not.toBeNull();
    // headings: colors + shades + hex code
    expect(picker.querySelectorAll(".color-picker__heading").length).toBe(3);
    expect(
      picker.querySelectorAll(".color-picker-content--default").length,
    ).toBe(2);
    // the default stroke color is `black`, a shade-less palette entry
    expect(picker.querySelector(".shades")).toBeNull();
    expect(picker.textContent).toContain("No shades available for this color");
    expect(picker.querySelector(".color-picker-input")).not.toBeNull();

    togglePopover("Stroke");
    expect(h.state.openPopup).toBe(null);
    expect(queryPicker()).toBeNull();
  });

  it("mirrors the upstream palette swatch contract", () => {
    togglePopover("Stroke");

    const red = getByTestId(container(), "color-red") as HTMLButtonElement;
    expect(red.getAttribute("aria-label")).toBe("Red — b");
    expect(red.getAttribute("title")).toBe(
      `Red ${COLOR_PALETTE.red[DEFAULT_ELEMENT_STROKE_COLOR_INDEX]} — b`,
    );
    expect(red.style.getPropertyValue("--swatch-color")).toBe(
      COLOR_PALETTE.red[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
    );
    expect(
      red.querySelector(".color-picker__button__hotkey-label")!.textContent,
    ).toBe("b");
    expect(red.querySelector(".color-picker__button-outline")).not.toBeNull();

    const white = getByTestId(container(), "color-white") as HTMLButtonElement;
    expect(white.classList).toContain("has-outline");
    expect(getByTestId(container(), "color-transparent").classList).toContain(
      "is-transparent",
    );
  });

  it("picks a palette color by its hotkey", () => {
    togglePopover("Stroke");

    pressInPicker("w");
    expect(h.state.currentItemStrokeColor).toBe(COLOR_PALETTE.white);

    pressInPicker("b");
    expect(h.state.currentItemStrokeColor).toBe(
      COLOR_PALETTE.red[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
    );
  });

  it("picks a shade with shift + digit", () => {
    togglePopover("Stroke");
    UI.clickOnTestId("color-red");

    pressInPicker("2", { code: "Digit2", shiftKey: true });
    expect(h.state.currentItemStrokeColor).toBe(COLOR_PALETTE.red[1]);

    const shades = container().querySelectorAll<HTMLButtonElement>(
      ".color-picker-content--default.shades .color-picker__button",
    );
    expect(shades.length).toBe(COLOR_PALETTE.red.length);
    expect(shades[1].classList).toContain("active");
    expect(
      shades[1].querySelector(".color-picker__button__hotkey-label")!
        .textContent,
    ).toBe("⇧2");
  });

  it("closes the popup on Escape", () => {
    togglePopover("Stroke");
    expect(h.state.openPopup).toBe("elementStroke");

    pressInPicker("Escape");
    expect(h.state.openPopup).toBe(null);
  });

  it("commits a custom color typed into the hex input", () => {
    togglePopover("Background");

    const input = container().querySelector<HTMLInputElement>(
      ".color-picker-input",
    )!;
    act(() => {
      fireEvent.change(input, { target: { value: "ff0000" } });
    });

    expect(h.state.currentItemBackgroundColor).toBe("#ff0000");
  });

  it("opens the canvas background picker with only the hex input", () => {
    fireEvent.click(getByTestId(container(), "main-menu-trigger"));

    const trigger = container().querySelector<HTMLButtonElement>(
      '[data-openpopup="canvasBackground"]',
    )!;
    act(() => {
      fireEvent.click(trigger);
    });

    expect(h.state.openPopup).toBe("canvasBackground");
    expect(container().querySelector(".color-picker-input")).not.toBeNull();
    // `palette={null}` — no palette grid, no shades
    expect(queryPicker()).toBeNull();
    expect(queryByTestId(container(), "color-red")).toBeNull();
  });
});
