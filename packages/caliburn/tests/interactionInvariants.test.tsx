import React from "react";

import { actionToggleViewMode } from "../src/actions/actionToggleViewMode";
import { Excalidraw } from "../src/index";
import { gesture, isGestureActive } from "../src/pan-gesture";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { GlobalTestState, act, render } from "./test-utils";

const mouse = new Pointer("mouse");

/** the in-flight pointer interaction, private to the editor component */
const pointerDownState = () =>
  (h.app as unknown as { pointerDownState: unknown }).pointerDownState;

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
