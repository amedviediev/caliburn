import React from "react";

import { KEYS, reseed } from "@excalidraw/common";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const mouse = new Pointer("mouse");

const selectFrameTool = () => {
  Keyboard.keyPress(KEYS.F);
  expect(h.state.activeTool.type).toBe("frame");
};

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

describe("frame tool", () => {
  it("draws a frame with the dragged bounds", () => {
    selectFrameTool();

    mouse.downAt(100, 100);
    mouse.moveTo(400, 300);
    mouse.upAt();

    expect(h.elements.length).toBe(1);
    const frame = h.elements[0];
    expect(frame.type).toBe("frame");
    expect([frame.x, frame.y, frame.width, frame.height]).toEqual([
      100, 100, 300, 200,
    ]);
    // the drawn frame is selected and the tool reverts, as for any other
    // drag-created element
    expect(h.state.selectedElementIds[frame.id]).toBe(true);
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("discards an invisibly small frame", () => {
    selectFrameTool();

    mouse.downAt(100, 100);
    mouse.upAt(100, 100);

    expect(h.elements.length).toBe(0);
  });

  it("adds the elements the drawn frame covers to it", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
    });
    API.setElements([rectangle]);

    selectFrameTool();

    mouse.downAt(100, 100);
    mouse.moveTo(400, 300);
    mouse.upAt();

    const frame = h.elements.find(
      (element): element is ExcalidrawFrameLikeElement =>
        element.type === "frame",
    )!;
    expect(frame).toBeDefined();
    expect(API.getElement(rectangle).frameId).toBe(frame.id);
  });

  it("highlights the elements the frame being drawn covers", () => {
    const inside = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
    });
    const outside = API.createElement({
      type: "rectangle",
      x: 600,
      y: 600,
      width: 50,
      height: 50,
    });
    API.setElements([inside, outside]);

    selectFrameTool();

    mouse.downAt(100, 100);
    mouse.moveTo(400, 300);

    expect(h.state.elementsToHighlight?.map((element) => element.id)).toEqual([
      inside.id,
    ]);

    mouse.upAt();

    expect(h.state.elementsToHighlight).toBe(null);
  });

  it("snaps the frame's origin to the grid, and CtrlOrCmd bypasses it", () => {
    API.setAppState({ gridModeEnabled: true, gridSize: 20 });

    selectFrameTool();
    mouse.downAt(107, 104);
    mouse.moveTo(400, 300);
    mouse.upAt();

    expect([h.elements[0].x, h.elements[0].y]).toEqual([100, 100]);

    API.setElements([]);

    selectFrameTool();
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(107, 104);
      mouse.moveTo(400, 300);
      mouse.upAt();
    });

    expect([h.elements[0].x, h.elements[0].y]).toEqual([107, 104]);
  });

  it("draws a magic frame when the magicframe tool is active", () => {
    // no UI selects the magicframe tool — upstream gates it behind its AI
    // (text-to-diagram / wireframe-to-code) surfaces, which caliburn omits
    h.app.setActiveTool({ type: "magicframe" });

    mouse.downAt(100, 100);
    mouse.moveTo(400, 300);
    mouse.upAt();

    expect(h.elements.length).toBe(1);
    expect(h.elements[0].type).toBe("magicframe");
    expect([h.elements[0].width, h.elements[0].height]).toEqual([300, 200]);
  });
});
