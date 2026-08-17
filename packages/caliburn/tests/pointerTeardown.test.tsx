import React from "react";

import { CURSOR_TYPE, KEYS, reseed } from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { gesture } from "../src/pan-gesture";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  GlobalTestState,
  fireEvent,
  render,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const mouse = new Pointer("mouse");

const cursor = () => GlobalTestState.interactiveCanvas.style.cursor;

beforeEach(() => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
});

describe("the tool revert on pointer up", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    h.state.width = 1000;
    h.state.height = 1000;
  });

  it("resets the cursor once a dragged-out element has settled", () => {
    UI.clickTool("rectangle");
    expect(cursor()).toBe(CURSOR_TYPE.CROSSHAIR);

    mouse.downAt(100, 100);
    mouse.moveTo(200, 200);
    mouse.upAt(200, 200);

    expect(h.state.activeTool.type).toBe("selection");
    expect(cursor()).toBe("");
  });

  it("resets the cursor once a dragged-out linear element has settled", () => {
    UI.clickTool("arrow");
    expect(cursor()).toBe(CURSOR_TYPE.CROSSHAIR);

    mouse.downAt(100, 100);
    mouse.moveTo(300, 200);
    mouse.upAt(300, 200);

    expect(h.state.activeTool.type).toBe("selection");
    expect(cursor()).toBe("");
  });

  it("hands a lasso grown out of the selection tool back on release", () => {
    mouse.downAt(100, 100);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.moveTo(150, 150);
    });
    expect(h.state.activeTool.type).toBe("lasso");
    expect(h.state.activeTool.fromSelection).toBe(true);

    mouse.upAt(150, 150);

    expect(h.state.activeTool.type).toBe("selection");
    expect(cursor()).toBe("");
  });

  it("resets the cursor once a multi-point element closed by its last click has settled", () => {
    UI.clickTool("line");
    mouse.clickAt(100, 100);
    mouse.moveTo(200, 100);
    mouse.clickAt(200, 100);
    mouse.moveTo(200, 200);
    mouse.clickAt(200, 200);
    // back inside the commit zone of the last committed point: the click
    // finalizes, so the release finds no `newElement` and takes the tail
    mouse.moveTo(202, 200);
    mouse.clickAt(202, 200);

    expect(h.state.multiElement).toBe(null);
    expect(h.state.activeTool.type).toBe("selection");
    expect(cursor()).toBe("");
  });
});

describe("a pointer released away from the canvas", () => {
  it("is dropped from the gesture", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    // a space-drag pan: it registers the pointer with the gesture and then
    // runs off its own window listeners, so no canvas release closes it
    fireEvent.keyDown(document, { key: KEYS.SPACE });
    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      pointerId: 3,
      clientX: 100,
      clientY: 100,
    });
    expect(gesture.pointers.has(3)).toBe(true);

    fireEvent.pointerUp(document.body, { pointerId: 3 });
    expect(gesture.pointers.has(3)).toBe(false);

    fireEvent.keyUp(document, { key: KEYS.SPACE });
  });
});

describe("the binding-preference restore", () => {
  it("lands once the pointer-down dispatch has returned", async () => {
    await render(<Excalidraw />);
    API.setAppState({ isBindingEnabled: false, bindingPreference: "enabled" });

    mouse.downAt(100, 100);
    expect(h.state.isBindingEnabled).toBe(true);

    mouse.upAt(100, 100);
  });

  it("stands down while ctrl is held", async () => {
    await render(<Excalidraw />);
    API.setAppState({ isBindingEnabled: false, bindingPreference: "enabled" });

    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
    });
    expect(h.state.isBindingEnabled).toBe(false);

    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
    });
  });

  it("loses to an object-form write the dispatch queues after it", async () => {
    await render(
      <Excalidraw
        onPointerDown={() => {
          h.setState({ isBindingEnabled: false });
        }}
      />,
    );
    API.setAppState({ isBindingEnabled: false, bindingPreference: "enabled" });

    mouse.downAt(100, 100);
    expect(h.state.isBindingEnabled).toBe(false);

    mouse.upAt(100, 100);
  });
});

describe("a pointer-down dispatch that throws", () => {
  /** the DOM reports a listener's exception rather than rethrowing it, so the
   * test has to claim it or the runner counts it as unhandled */
  const swallowUncaught = (event: ErrorEvent) => event.preventDefault();

  beforeEach(() => {
    window.addEventListener("error", swallowUncaught);
  });

  afterEach(() => {
    window.removeEventListener("error", swallowUncaught);
  });

  it("still applies the selection clear it had queued", async () => {
    await render(
      <Excalidraw
        onPointerDown={() => {
          throw new Error("host callback blew up");
        }}
      />,
    );
    h.state.width = 1000;
    h.state.height = 1000;

    const rectangle = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    // a non-selection tool arms the clear before the dispatch runs
    UI.clickTool("ellipse");
    API.setSelectedElements([rectangle]);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    mouse.downAt(100, 100);

    expect(h.state.selectedElementIds).toEqual({});

    mouse.upAt(100, 100);
  });
});
