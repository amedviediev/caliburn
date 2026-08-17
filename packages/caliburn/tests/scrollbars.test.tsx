import React from "react";

import { arrayToMap, reseed } from "@excalidraw/common";
import { getTransformHandles } from "@excalidraw/element";
import { getScrollBars } from "@excalidraw/excalidraw/scene/scrollbars";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { RenderableElementsMap } from "@excalidraw/excalidraw/scene/types";

import { Excalidraw } from "../src/index";
import { getInteractiveRendererParams } from "../src/render";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import {
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const mouse = new Pointer("mouse");

/** the same geometry the interactive renderer paints and hit-tests against */
const scrollBars = () =>
  getScrollBars(
    arrayToMap(h.elements) as RenderableElementsMap,
    h.state.width,
    h.state.height,
    h.state,
  );

/** a rectangle taller than the viewport, so a vertical scrollbar exists */
const tallRectangle = () =>
  API.createElement({
    type: "rectangle",
    x: 800,
    y: 100,
    width: 100,
    height: 1000,
  });

beforeEach(() => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
  mockBoundingClientRect({ width: 1000, height: 1000 });
});

afterEach(() => {
  restoreOriginalGetBoundingClientRect();
});

describe("canvas scrollbars", () => {
  describe("with the prop left at its default", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("does not paint them", () => {
      API.setElements([tallRectangle()]);

      expect(
        getInteractiveRendererParams(h.app)?.renderConfig.renderScrollbars,
      ).toBe(false);
    });

    it("leaves the scrollbar band to the regular pointer handling", () => {
      API.setElements([tallRectangle()]);
      const vertical = scrollBars().vertical!;
      const scrollY = h.state.scrollY;

      mouse.downAt(vertical.x + vertical.width / 2, vertical.y + 20);
      mouse.moveTo(vertical.x + vertical.width / 2, vertical.y + 120);

      // no scrollbar to grab, so the press started a box selection instead
      expect(h.state.scrollY).toBe(scrollY);
      expect(h.state.selectionElement).not.toBe(null);

      mouse.upAt(vertical.x + vertical.width / 2, vertical.y + 120);
    });
  });

  describe("with the prop on", () => {
    beforeEach(async () => {
      await render(<Excalidraw renderScrollbars />);
    });

    it("paints them", () => {
      API.setElements([tallRectangle()]);

      expect(
        getInteractiveRendererParams(h.app)?.renderConfig.renderScrollbars,
      ).toBe(true);
      expect(scrollBars().vertical).not.toBe(null);
    });

    it("scrolls the viewport when the vertical bar is dragged", () => {
      API.setElements([tallRectangle()]);
      const vertical = scrollBars().vertical!;
      const scrollY = h.state.scrollY;
      const x = vertical.x + vertical.width / 2;

      mouse.downAt(x, vertical.y + 20);
      mouse.moveTo(x, vertical.y + 120);

      expect(h.state.scrollY).toBeLessThan(scrollY);
      // the press was consumed by the scrollbar, not by the selection tool
      expect(h.state.selectionElement).toBe(null);

      mouse.upAt(x, vertical.y + 120);
    });

    it("shows no resizing cursor over a transform handle under the bar", () => {
      const covered = API.createElement({
        type: "rectangle",
        // the right edge reaches under the vertical scrollbar
        x: 700,
        y: 100,
        width: 291,
        height: 1000,
      });
      API.setElements([covered]);
      API.setSelectedElements([covered]);

      const vertical = scrollBars().vertical!;
      const [hx, hy] = handleCenter(covered, "e");
      // the case the clause arbitrates: the handle really is under the bar
      expect(hx).toBeGreaterThanOrEqual(vertical.x);
      expect(hx).toBeLessThanOrEqual(vertical.x + vertical.width);
      expect(hy).toBeGreaterThanOrEqual(vertical.y);
      expect(hy).toBeLessThanOrEqual(vertical.y + vertical.height);

      mouse.moveTo(hx, hy);

      expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe(
        "ew-resize",
      );
    });
  });
});

/** the client coords of the centre of a transform handle */
function handleCenter(
  element: ExcalidrawElement,
  handle: "e",
): [number, number] {
  const coords = getTransformHandles(
    element,
    h.state.zoom,
    arrayToMap(h.elements),
    "mouse",
    {},
  )[handle]!;
  return [coords[0] + coords[2] / 2, coords[1] + coords[3] / 2];
}
