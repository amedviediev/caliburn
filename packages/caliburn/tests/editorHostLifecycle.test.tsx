import React from "react";

import { KEYS, reseed } from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const mouse = new Pointer("mouse");

const container = () =>
  document.querySelector<HTMLDivElement>(".excalidraw-container")!;

describe("editor host lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    reseed(7);
    mouse.reset();
  });

  describe("overscroll behavior", () => {
    afterEach(() => {
      document.documentElement.style.overscrollBehaviorX = "";
    });

    it("suspends it while the pointer is inside the editor", async () => {
      await render(<Excalidraw />);

      fireEvent.pointerEnter(container());
      expect(document.documentElement.style.overscrollBehaviorX).toBe("none");

      fireEvent.pointerLeave(container());
      expect(document.documentElement.style.overscrollBehaviorX).toBe("auto");
    });

    it("leaves it alone while the editor is non-interactive", async () => {
      await render(<Excalidraw interaction={false} />);

      fireEvent.pointerEnter(container());
      expect(document.documentElement.style.overscrollBehaviorX).toBe("");
    });
  });

  describe("unload teardown", () => {
    it("releases a held space bar and the suspended binding", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      h.state.width = 1000;
      h.state.height = 1000;

      API.setAppState({ isBindingEnabled: false });
      fireEvent.keyDown(document, { key: KEYS.SPACE });

      act(() => {
        window.dispatchEvent(new Event("unload"));
      });

      expect(h.state.isBindingEnabled).toBe(true);

      // the space bar is no longer held, so the drag box-selects instead of
      // panning
      const scrollX = h.state.scrollX;
      mouse.downAt(100, 100);
      mouse.moveTo(200, 200);

      expect(h.state.scrollX).toBe(scrollX);
      expect(h.state.selectionElement).not.toBe(null);

      mouse.upAt(200, 200);
    });
  });

  describe("refresh()", () => {
    afterEach(() => {
      restoreOriginalGetBoundingClientRect();
    });

    it("re-measures the container offsets after it moved", async () => {
      mockBoundingClientRect({ width: 800, height: 600, left: 0, top: 0 });
      await render(<Excalidraw />);

      expect(h.state.offsetLeft).toBe(0);
      expect(h.state.offsetTop).toBe(0);

      // the host moved the editor without resizing it, so no ResizeObserver
      // callback reports the change
      mockBoundingClientRect({ width: 800, height: 600, left: 40, top: 25 });

      act(() => {
        h.app.refresh();
      });

      expect(h.state.offsetLeft).toBe(40);
      expect(h.state.offsetTop).toBe(25);
      expect(h.state.width).toBe(800);
      expect(h.state.height).toBe(600);
    });
  });
});
