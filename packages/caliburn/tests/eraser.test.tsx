import { CURSOR_TYPE, KEYS } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";

import * as StaticScene from "@excalidraw/excalidraw/renderer/staticScene";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

const mouse = new Pointer("mouse");

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

/** the pending-erasure set the last static render was handed */
const renderedPendingErasure = () =>
  renderStaticScene.mock.calls.at(-1)![0].renderConfig.elementsPendingErasure;

/**
 * The scene is seeded through `initialData` rather than `API.setElements` so
 * the store's baseline snapshot holds it: the erase then produces exactly one
 * history entry, which is what the undo case measures. `{}` is passed to
 * `mockBoundingClientRect` for its per-field defaults — a 1920x1080 editor at
 * the viewport origin, so client and scene coordinates coincide and the
 * eraser's candidates (`app.visibleElements`) cover the whole scene.
 */
const setup = async (elements: ExcalidrawElement[]) => {
  mockBoundingClientRect({});
  await render(
    <Excalidraw handleKeyboardGlobally={true} initialData={{ elements }} />,
  );
  mouse.reset();
};

const selectEraser = () => {
  act(() => {
    h.app.setActiveTool({ type: "eraser" });
  });
};

/**
 * `EraserTrail.addPointToPath` tests the segment between the last two points
 * of the trail, so a gesture has to be walked in steps the way a hand does —
 * a single jump from origin to target would only ever test one long segment.
 */
const moveAlong = (
  from: [number, number],
  to: [number, number],
  steps = 12,
) => {
  for (let step = 1; step <= steps; step++) {
    mouse.moveTo(
      from[0] + ((to[0] - from[0]) * step) / steps,
      from[1] + ((to[1] - from[1]) * step) / steps,
    );
  }
};

const eraseAlong = (
  from: [number, number],
  to: [number, number],
  { release = true }: { release?: boolean } = {},
) => {
  mouse.downAt(from[0], from[1]);
  moveAlong(from, to);
  if (release) {
    mouse.upAt(to[0], to[1]);
  }
};

const isDeleted = (element: ExcalidrawElement) =>
  h.elements.find((el) => el.id === element.id)!.isDeleted;

const row = () => {
  const left = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const middle = API.createElement({
    type: "rectangle",
    x: 200,
    y: 0,
    width: 100,
    height: 100,
  });
  const right = API.createElement({
    type: "rectangle",
    x: 400,
    y: 0,
    width: 100,
    height: 100,
  });
  return { left, middle, right, elements: [left, middle, right] };
};

describe("eraser tool", () => {
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("erases exactly the elements the trail crossed, in one history entry", async () => {
    const { left, middle, right, elements } = row();
    await setup(elements);
    selectEraser();

    eraseAlong([10, 50], [310, 50], { release: false });

    expect([...h.app.elementsPendingErasure].sort()).toEqual(
      [left.id, middle.id].sort(),
    );
    // and the renderer is handed them, so the marked shapes are drawn faded
    expect([...renderedPendingErasure()!].sort()).toEqual(
      [left.id, middle.id].sort(),
    );

    mouse.upAt(310, 50);

    expect(isDeleted(left)).toBe(true);
    expect(isDeleted(middle)).toBe(true);
    expect(isDeleted(right)).toBe(false);
    expect(h.app.elementsPendingErasure.size).toBe(0);
    expect(API.getUndoStack().length).toBe(1);

    Keyboard.undo();

    expect(isDeleted(left)).toBe(false);
    expect(isDeleted(middle)).toBe(false);
    expect(isDeleted(right)).toBe(false);
  });

  it("stays on the eraser after erasing", async () => {
    const { left, elements } = row();
    await setup(elements);
    selectEraser();

    eraseAlong([10, 50], [110, 50]);

    expect(isDeleted(left)).toBe(true);
    expect(h.state.activeTool.type).toBe("eraser");
  });

  it("restores an element marked for erasure when the trail is retraced with alt held", async () => {
    const { left, elements } = row();
    await setup(elements);
    selectEraser();

    eraseAlong([10, 50], [110, 50], { release: false });
    expect(h.app.elementsPendingErasure.has(left.id)).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      moveAlong([110, 50], [30, 50]);
    });
    expect(h.app.elementsPendingErasure.size).toBe(0);

    mouse.upAt(30, 50);

    expect(isDeleted(left)).toBe(false);
    expect(API.getUndoStack().length).toBe(0);
  });

  it("erases the element under the pointer on a click without a drag", async () => {
    const { left, middle, elements } = row();
    await setup(elements);
    selectEraser();

    // a transparent shape is hit on its stroke only, the eraser's
    // click-without-drag path included (`getElementsAtPosition`)
    mouse.clickAt(50, 0);

    expect(isDeleted(left)).toBe(true);
    expect(isDeleted(middle)).toBe(false);
  });

  it("erases a frame's children along with the frame", async () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const child = API.createElement({
      type: "rectangle",
      x: 40,
      y: 40,
      width: 60,
      height: 60,
      frameId: frame.id,
    });
    await setup([frame, child]);
    selectEraser();

    eraseAlong([-20, 100], [20, 100]);

    expect(isDeleted(frame)).toBe(true);
    expect(isDeleted(child)).toBe(true);
  });

  it("erases a container's bound text along with the container", async () => {
    const boundTextId = "eraser-bound-text";
    const container = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      boundElements: [{ type: "text", id: boundTextId }],
    });
    const boundText = API.createElement({
      type: "text",
      id: boundTextId,
      x: 20,
      y: 30,
      width: 60,
      height: 25,
      containerId: container.id,
    });
    await setup([container, boundText]);
    selectEraser();

    eraseAlong([-20, 50], [20, 50]);

    expect(isDeleted(container)).toBe(true);
    expect(isDeleted(boundText)).toBe(true);
  });

  it("never erases locked elements", async () => {
    const locked = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      locked: true,
    });
    const unlocked = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    });
    await setup([locked, unlocked]);
    selectEraser();

    eraseAlong([10, 50], [310, 50], { release: false });
    expect([...h.app.elementsPendingErasure]).toEqual([unlocked.id]);
    mouse.upAt(310, 50);

    expect(isDeleted(locked)).toBe(false);
    expect(isDeleted(unlocked)).toBe(true);

    // the click-without-drag path filters locked elements out too
    mouse.clickAt(50, 0);

    expect(isDeleted(locked)).toBe(false);
  });

  it("ends the trail and restores the marked elements when the tool changes mid-gesture", async () => {
    const { left, elements } = row();
    await setup(elements);
    selectEraser();

    eraseAlong([10, 50], [110, 50], { release: false });
    expect(h.app.elementsPendingErasure.has(left.id)).toBe(true);
    expect(h.app.eraserTrail.hasCurrentTrail).toBe(true);

    act(() => {
      h.app.setActiveTool({ type: "selection" });
    });

    expect(h.app.eraserTrail.hasCurrentTrail).toBe(false);

    mouse.upAt(110, 50);

    expect(isDeleted(left)).toBe(false);
    expect(h.app.elementsPendingErasure.size).toBe(0);
  });

  it("switches back to the selection tool when elements get selected under the eraser", async () => {
    const { left, elements } = row();
    await setup(elements);
    selectEraser();

    API.setAppState({ selectedElementIds: { [left.id]: true } });

    expect(h.state.activeTool.type).toBe("selection");
  });

  it("keeps a host-controlled eraser when elements get selected, clearing the selection instead", async () => {
    const { left, elements } = row();
    mockBoundingClientRect({});
    await render(
      <Excalidraw activeTool={{ type: "eraser" }} initialData={{ elements }} />,
    );
    mouse.reset();

    API.setAppState({
      selectedElementIds: { [left.id]: true },
      selectedGroupIds: { [left.id]: true },
      editingGroupId: left.id,
    });

    // upstream settles on the forced tool with nothing selected — it gets
    // there through `handleForcedToolChange` -> `setActiveTool`, whose
    // non-selection branch clears the selection
    expect(h.state.activeTool.type).toBe("eraser");
    expect(h.state.selectedElementIds).toEqual({});
    expect(h.state.selectedGroupIds).toEqual({});
    expect(h.state.editingGroupId).toBe(null);
    expect(h.state.multiElement).toBe(null);
  });

  it("takes no hover affordance from an embeddable, which the laser does", async () => {
    const embeddable = newElementWith(
      API.createElement({
        type: "embeddable",
        x: 40,
        y: 40,
        width: 300,
        height: 180,
      }),
      { link: "https://www.youtube.com/watch?v=gkGMXY0wekg" },
    );
    await setup([embeddable]);
    const centerX = embeddable.x + embeddable.width / 2;
    const centerY = embeddable.y + embeddable.height / 2;

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
    mouse.moveTo(centerX, centerY);
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.POINTER,
    );

    selectEraser();
    const cursorBeforeHover = GlobalTestState.interactiveCanvas.style.cursor;
    mouse.reset();
    mouse.moveTo(centerX, centerY);

    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      cursorBeforeHover,
    );
  });

  it("is activated by its keyboard shortcut and toolbar button", async () => {
    await setup([]);

    Keyboard.keyPress(KEYS.E);
    expect(h.state.activeTool.type).toBe("eraser");

    UI.clickTool("selection");
    expect(h.state.activeTool.type).toBe("selection");

    UI.clickTool("eraser");
    expect(h.state.activeTool.type).toBe("eraser");
  });
});
