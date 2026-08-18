import React from "react";

import { CURSOR_TYPE, arrayToMap, reseed } from "@excalidraw/common";
import { newElement } from "@excalidraw/element";
import { getScrollBars } from "@excalidraw/excalidraw/scene/scrollbars";

import type {
  ExcalidrawLinearElement,
  ExcalidrawNonSelectionElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { RenderableElementsMap } from "@excalidraw/excalidraw/scene/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import {
  act,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const mouse = new Pointer("mouse");

const cursor = () => GlobalTestState.interactiveCanvas.style.cursor;

/** a cursor no tool and no hover affordance ever paints, so any write to it
 * during the move under test is visible */
const SENTINEL = "cell";

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

describe("the idle per-move cursor", () => {
  describe("without scrollbars", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("restores the tool's cursor on an idle move over blank canvas", () => {
      UI.clickTool("rectangle");
      act(() => h.app.cursor.set(SENTINEL));

      mouse.moveTo(300, 300);

      expect(cursor()).toBe(CURSOR_TYPE.CROSSHAIR);
    });

    describe("stands down while an interaction owns the pointer", () => {
      beforeEach(() => {
        UI.clickTool("rectangle");
      });

      it("a new element is being drawn", () => {
        const element = API.createElement({
          type: "rectangle",
        }) as NonDeleted<ExcalidrawNonSelectionElement>;
        act(() => h.app.setState({ newElement: element }));
        act(() => h.app.cursor.set(SENTINEL));

        mouse.moveTo(300, 300);

        expect(cursor()).toBe(SENTINEL);
      });

      it("a box selection is being dragged out", () => {
        const element = newElement({ type: "selection", x: 0, y: 0 });
        act(() => h.app.setState({ selectionElement: element }));
        act(() => h.app.cursor.set(SENTINEL));

        mouse.moveTo(300, 300);

        expect(cursor()).toBe(SENTINEL);
      });

      it("the selection is being dragged", () => {
        act(() => h.app.setState({ selectedElementsAreBeingDragged: true }));
        act(() => h.app.cursor.set(SENTINEL));

        mouse.moveTo(300, 300);

        expect(cursor()).toBe(SENTINEL);
      });

      it("a multi-point element is being laid down", () => {
        const element = API.createElement({
          type: "line",
        }) as NonDeleted<ExcalidrawLinearElement>;
        act(() => h.app.setState({ multiElement: element }));
        act(() => h.app.cursor.set(SENTINEL));

        mouse.moveTo(300, 300);

        expect(cursor()).toBe(SENTINEL);
      });
    });
  });

  describe("over a scrollbar", () => {
    beforeEach(async () => {
      await render(<Excalidraw renderScrollbars />);
    });

    it("hands the cursor back to the environment for a drawing tool", () => {
      API.setElements([tallRectangle()]);
      UI.clickTool("rectangle");
      const vertical = scrollBars().vertical!;

      mouse.moveTo(vertical.x + vertical.width / 2, vertical.y + 20);

      expect(cursor()).toBe(CURSOR_TYPE.AUTO);
    });

    it("wins over the move cursor of a selection lying under the bar", () => {
      const covered = API.createElement({
        type: "rectangle",
        // the right edge reaches under the vertical scrollbar
        x: 700,
        y: 100,
        width: 300,
        height: 1000,
      });
      API.setElements([covered]);
      API.setSelectedElements([covered]);

      const vertical = scrollBars().vertical!;
      const x = vertical.x + vertical.width / 2;
      const y = vertical.y + 200;
      // the case the arm arbitrates: the pointer is inside the selection's
      // bounding box — where the hover chain paints the move cursor — and
      // over the bar at the same time
      expect(x).toBeGreaterThan(covered.x);
      expect(x).toBeLessThan(covered.x + covered.width);
      expect(y).toBeGreaterThan(covered.y);
      expect(y).toBeLessThan(covered.y + covered.height);

      mouse.moveTo(x, y);

      expect(cursor()).toBe(CURSOR_TYPE.AUTO);
    });
  });
});
