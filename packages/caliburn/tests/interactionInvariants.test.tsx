import React from "react";

import { actionToggleViewMode } from "../src/actions/actionToggleViewMode";
import { Excalidraw } from "../src/index";
import { gesture, isGestureActive } from "../src/pan-gesture";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { GlobalTestState, act, fireEvent, render } from "./test-utils";

const mouse = new Pointer("mouse");

/** the in-flight pointer interaction, private to the editor component */
const pointerDownState = () =>
  (h.app as unknown as { pointerDownState: unknown }).pointerDownState;

/** the bucket click armed on pointer down, private to the bucket-fill host */
const armedBucketFill = () =>
  (h.app.bucketFill as unknown as { pending: unknown }).pending;

/** a UI element layered over the canvas, as a pointer-event target */
const overlay = () =>
  GlobalTestState.renderResult.getByToolName("selection") as HTMLElement;

describe("interaction invariants", () => {
  beforeEach(() => {
    mouse.reset();
  });

  it("drops the in-flight pointer interaction when disabled", async () => {
    await render(<Excalidraw />);
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      }),
    ]);

    // a drag is in flight (no pointerup yet)
    mouse.down(10, 10);
    mouse.move(10, 10);
    expect(pointerDownState()).not.toBe(null);

    GlobalTestState.renderResult.rerender(<Excalidraw interaction={false} />);

    expect(pointerDownState()).toBe(null);
    expect(isGestureActive()).toBe(false);
    expect(gesture.pointers.size).toBe(0);
  });

  it("ends the in-flight pan session when disabled", async () => {
    await render(<Excalidraw />);
    UI.clickTool("hand");

    mouse.down(10, 10);
    expect(isGestureActive()).toBe(true);

    mouse.moveTo(40, 40);
    const { scrollX, scrollY } = h.state;
    expect(scrollX).not.toBe(0);

    GlobalTestState.renderResult.rerender(<Excalidraw interaction={false} />);
    expect(isGestureActive()).toBe(false);

    // the pan session's window listeners are gone — dragging on no longer
    // translates the viewport
    mouse.moveTo(120, 120);
    expect(h.state.scrollX).toBe(scrollX);
    expect(h.state.scrollY).toBe(scrollY);
  });

  it("completes a drag released over the UI", async () => {
    const updates: { button: string }[] = [];
    await render(
      <Excalidraw
        onPointerUpdate={(payload: { button: string }) => updates.push(payload)}
      />,
    );
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    mouse.downAt(25, 25);
    // the pointer leaves the canvas mid-drag: the gesture's window listeners
    // are what keep it running
    fireEvent.pointerMove(overlay(), { clientX: 125, clientY: 75 });
    expect(h.elements[0]).toEqual(
      expect.objectContaining({ x: 100, y: 50, isDeleted: false }),
    );

    updates.length = 0;
    fireEvent.pointerUp(overlay(), { clientX: 125, clientY: 75 });

    expect(pointerDownState()).toBe(null);
    expect(h.state.cursorButton).toBe("up");
    expect(updates.at(-1)).toEqual(expect.objectContaining({ button: "up" }));
    expect(h.state.selectedElementsAreBeingDragged).toBe(false);

    // the released drag does not resume when the pointer comes back
    mouse.moveTo(200, 200);
    expect(h.elements[0]).toEqual(expect.objectContaining({ x: 100, y: 50 }));
  });

  it("captures the pointer to the canvas on pointer down", async () => {
    await render(<Excalidraw />);
    const setPointerCapture = vi.spyOn(
      HTMLElement.prototype,
      "setPointerCapture",
    );

    const pointerId = 7;
    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      clientX: 25,
      clientY: 25,
      pointerId,
    });

    expect(setPointerCapture).toHaveBeenCalledWith(pointerId);
    expect(setPointerCapture.mock.contexts[0]).toBe(
      GlobalTestState.interactiveCanvas,
    );

    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      clientX: 25,
      clientY: 25,
      pointerId,
    });
    setPointerCapture.mockRestore();
  });

  it("disarms an armed bucket click when disabled", async () => {
    await render(<Excalidraw />);
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 20,
        y: 20,
        width: 120,
        height: 100,
        roundness: null,
        backgroundColor: "transparent",
      }),
    ]);
    act(() => {
      h.app.setActiveTool({ type: "bucketfill" });
    });

    // the click is armed but never released
    mouse.downAt(80, 70);
    expect(armedBucketFill()).not.toBe(null);

    GlobalTestState.renderResult.rerender(<Excalidraw interaction={false} />);

    expect(armedBucketFill()).toBe(null);
    expect(h.state.cursorButton).toBe("up");
    // the interrupted click must not leave a permanent edit
    expect(h.elements.filter((el) => el.type === "line")).toHaveLength(0);
  });

  it("closes an open eye dropper when disabled", async () => {
    await render(<Excalidraw />);
    act(() => {
      h.app.bucketFill.openTemporaryEyeDropper();
    });
    expect(h.app.activeEyeDropper()).not.toBe(null);

    GlobalTestState.renderResult.rerender(<Excalidraw interaction={false} />);

    expect(h.app.activeEyeDropper()).toBe(null);
  });

  it("keeps view mode enabled while non-interactive", async () => {
    await render(<Excalidraw interaction={false} />);
    expect(h.state.viewModeEnabled).toBe(true);

    API.setAppState({ viewModeEnabled: false });
    expect(h.state.viewModeEnabled).toBe(true);

    act(() => {
      h.app.updateScene({ appState: { viewModeEnabled: false } });
    });
    expect(h.state.viewModeEnabled).toBe(true);

    // programmatic action execution bypasses the interaction gate
    API.executeAction(actionToggleViewMode);
    expect(h.state.viewModeEnabled).toBe(true);
  });

  it("restores the host's view mode once interaction returns", async () => {
    await render(<Excalidraw interaction={false} />);
    expect(h.state.viewModeEnabled).toBe(true);

    GlobalTestState.renderResult.rerender(<Excalidraw />);
    expect(h.state.viewModeEnabled).toBe(false);
  });
});
