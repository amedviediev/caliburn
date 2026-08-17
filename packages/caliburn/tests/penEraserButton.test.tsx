import React from "react";
import { vi } from "vitest";

import { POINTER_BUTTON } from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { act, fireEvent, GlobalTestState, render } from "./test-utils";

const eraserButtonDown = (clientX = 30, clientY = 30) => {
  fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
    button: POINTER_BUTTON.ERASER,
    pointerType: "pen",
    clientX,
    clientY,
  });
};

const eraserButtonUp = (clientX = 30, clientY = 30) => {
  fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
    button: POINTER_BUTTON.ERASER,
    pointerType: "pen",
    clientX,
    clientY,
  });
};

const nextAnimationFrame = () =>
  act(
    async () =>
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(null)),
      ),
  );

/** the active tool as each pass through the pointer-down handler sees it */
const recordPointerDownPasses = () => {
  const passes: string[] = [];
  const handler = h.app.handleCanvasPointerDown.bind(h.app);
  const spy = vi
    .spyOn(h.app, "handleCanvasPointerDown")
    .mockImplementation((event) => {
      passes.push(h.state.activeTool.type);
      handler(event);
    });
  return { passes, restore: () => spy.mockRestore() };
};

describe("pen hardware eraser button", () => {
  it("erases for the duration of the button press, then restores the tool", async () => {
    await render(<Excalidraw />);

    expect(h.state.activeTool.type).toBe("selection");

    eraserButtonDown();
    expect(h.state.activeTool.type).toBe("eraser");
    expect(h.state.activeTool.lastActiveTool?.type).toBe("selection");

    eraserButtonUp();
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.state.activeTool.lastActiveTool).toBe(null);
  });

  it("restores whichever tool the button interrupted", async () => {
    await render(<Excalidraw />);

    act(() => {
      h.app.setActiveTool({ type: "rectangle" });
    });

    eraserButtonDown();
    expect(h.state.activeTool.type).toBe("eraser");
    expect(h.state.activeTool.lastActiveTool?.type).toBe("rectangle");

    eraserButtonUp();
    expect(h.state.activeTool.type).toBe("rectangle");
    expect(h.state.activeTool.lastActiveTool).toBe(null);
  });

  it("re-enters the pointer-down flow with the eraser already active", async () => {
    await render(<Excalidraw />);

    const { passes, restore } = recordPointerDownPasses();

    try {
      eraserButtonDown();
    } finally {
      restore();
    }

    expect(passes).toEqual(["selection", "eraser"]);
  });

  it("lets the eraser button through the primary-button gate", async () => {
    // host-forced tool: the switch is blocked, so the button reaches the
    // active tool's own pointer-down
    await render(<Excalidraw activeTool={{ type: "laser" }} />);

    eraserButtonDown();
    expect(h.app.laserTrails.localTrail.hasCurrentTrail).toBe(true);

    eraserButtonUp();
  });

  it("doesn't switch when the eraser is already active", async () => {
    await render(<Excalidraw />);

    act(() => {
      h.app.setActiveTool({ type: "eraser" });
    });
    expect(h.state.activeTool.lastActiveTool?.type).toBe("selection");

    eraserButtonDown();
    expect(h.state.activeTool.type).toBe("eraser");
    // untouched — a second switch would have recorded the eraser itself
    expect(h.state.activeTool.lastActiveTool?.type).toBe("selection");

    eraserButtonUp();
    expect(h.state.activeTool.type).toBe("eraser");
  });

  it("doesn't switch when the host controls the tool", async () => {
    await render(<Excalidraw activeTool={{ type: "selection" }} />);

    const { passes, restore } = recordPointerDownPasses();

    try {
      eraserButtonDown();
    } finally {
      restore();
    }

    // no re-entry: the eraser was never made active, not even for the
    // pointer-down the host prop would have snapped back afterwards
    expect(passes).toEqual(["selection"]);
    expect(h.state.activeTool.type).toBe("selection");

    eraserButtonUp();
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("restores the tool when the pointer up never arrives", async () => {
    await render(<Excalidraw />);

    eraserButtonDown();
    expect(h.state.activeTool.type).toBe("eraser");

    // the missing-pointer-up cleanup runs on window focus; the subscription
    // is deferred by a frame so a focus arriving with this very pointerdown
    // (coming from a blurred document) doesn't cancel the erase
    fireEvent.focus(window);
    expect(h.state.activeTool.type).toBe("eraser");

    await nextAnimationFrame();
    fireEvent.focus(window);
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.state.activeTool.lastActiveTool).toBe(null);
  });
});
