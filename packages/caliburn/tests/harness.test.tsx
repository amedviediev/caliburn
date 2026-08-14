import React from "react";

import { reseed } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  GlobalTestState,
  assertSelectedElements,
  fireEvent,
  render,
  unmountComponent,
} from "./test-utils";

const mouse = new Pointer("mouse");

unmountComponent();

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

describe("harness", () => {
  it("mounts the editor with both canvases", () => {
    expect(GlobalTestState.canvas).not.toBeNull();
    expect(GlobalTestState.interactiveCanvas).not.toBeNull();
    expect(h.state.isLoading).toBe(false);
    expect(h.app.handleKeyboardGlobally()).toBe(true);
  });

  it("exposes app state through the h handle", () => {
    expect(h.state.zenModeEnabled).toBe(false);
    API.setAppState({ zenModeEnabled: true });
    expect(h.state.zenModeEnabled).toBe(true);
  });

  it("drives the scene through the h handle", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);
    expect(h.elements.length).toBe(1);
    expect(h.elements[0].id).toBe(rect.id);
    expect(h.scene.getNonDeletedElements().length).toBe(1);
  });

  it("selects tools from the toolbar", () => {
    UI.clickTool("rectangle");
    expect(h.state.activeTool.type).toBe("rectangle");
    UI.clickTool("ellipse");
    expect(h.state.activeTool.type).toBe("ellipse");
  });

  it("tracks selection state", () => {
    const rect = API.createElement({ type: "rectangle" });
    API.setElements([rect]);
    API.setAppState({ selectedElementIds: { [rect.id]: true } });
    assertSelectedElements([rect.id]);
    expect(API.getSelectedElements().length).toBe(1);
  });

  it("fires pointer and keyboard events without crashing", () => {
    mouse.down(10, 10);
    mouse.move(30, 40);
    mouse.up();
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress("a");
    });
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
  });

  it("records captured updates in the store snapshot and history", () => {
    const rect = API.createElement({ type: "rectangle" });
    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    expect(API.getSnapshot().map((el) => el.id)).toEqual([rect.id]);
    expect(API.getUndoStack().length).toBe(1);
    expect(API.getRedoStack()).toEqual([]);
  });
});
