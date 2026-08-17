import {
  DOUBLE_TAP_POSITION_THRESHOLD,
  TAP_TWICE_TIMEOUT,
  TOUCH_CTX_MENU_TIMEOUT,
  reseed,
} from "@excalidraw/common";

import type {
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { gesture } from "../src/pan-gesture";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  render,
  unmountComponent,
} from "./test-utils";

unmountComponent();

/** jsdom has no `Touch` constructor; `TouchEvent` takes the plain shape */
const finger = (clientX: number, clientY: number) =>
  ({ clientX, clientY } as Touch);

const fireTouch = (
  type: "touchstart" | "touchend" | "touchmove",
  touches: Touch[],
) => {
  act(() => {
    GlobalTestState.interactiveCanvas.dispatchEvent(
      new TouchEvent(type, { bubbles: true, cancelable: true, touches }),
    );
  });
};

const touchDown = (clientX: number, clientY: number, pointerId = 1) => {
  fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
    clientX,
    clientY,
    button: 0,
    pointerId,
    pointerType: "touch",
  });
};

const touchUp = (clientX: number, clientY: number, pointerId = 1) => {
  fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
    clientX,
    clientY,
    pointerId,
    pointerType: "touch",
  });
};

const seedRectangle = () => {
  const rectangle = API.createElement({
    type: "rectangle",
    x: 20,
    y: 20,
    width: 100,
    height: 100,
  });
  API.setElements([rectangle]);
  return rectangle;
};

describe("touch input", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("tap twice to insert text", () => {
    it("inserts text where a second single-finger tap lands", () => {
      fireTouch("touchstart", [finger(100, 120)]);
      expect(h.state.editingTextElement).toBeNull();

      fireTouch("touchstart", [finger(100, 120)]);

      const text = h.state.editingTextElement;
      expect(text).not.toBeNull();
      expect(text?.type).toBe("text");
      expect(text!.x).toBeCloseTo(100, 0);
      // the caret is vertically centred on the tap
      expect(text!.y + text!.height / 2).toBeCloseTo(120, 0);
    });

    it("inserts no text when the second tap drifts past the threshold", () => {
      fireTouch("touchstart", [finger(100, 120)]);
      fireTouch("touchstart", [
        finger(100 + DOUBLE_TAP_POSITION_THRESHOLD + 1, 120),
      ]);

      expect(h.state.editingTextElement).toBeNull();
    });

    it("inserts no text once the tap-twice window has elapsed", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      fireTouch("touchstart", [finger(100, 120)]);
      act(() => {
        vi.advanceTimersByTime(TAP_TWICE_TIMEOUT);
      });
      fireTouch("touchstart", [finger(100, 120)]);

      expect(h.state.editingTextElement).toBeNull();
    });

    it("inserts no text when the second tap is a second finger (zooming)", () => {
      fireTouch("touchstart", [finger(100, 120)]);
      fireTouch("touchstart", [finger(100, 120), finger(160, 180)]);

      expect(h.state.editingTextElement).toBeNull();
    });

    it("ends the lasso trail and deselects before inserting", () => {
      const rectangle = seedRectangle();
      API.setSelectedElements([rectangle]);
      const endPath = vi.spyOn(h.app.lassoTrail, "endPath");

      fireTouch("touchstart", [finger(300, 300)]);
      fireTouch("touchstart", [finger(300, 300)]);

      expect(endPath).toHaveBeenCalled();
      expect(h.state.selectedElementIds[rectangle.id]).toBeFalsy();
      endPath.mockRestore();
    });
  });

  describe("two fingers", () => {
    it("drops the selection and the active embeddable", () => {
      const rectangle = seedRectangle();
      API.setSelectedElements([rectangle]);
      act(() => {
        API.setAppState({
          activeEmbeddable: { element: rectangle as any, state: "active" },
        });
      });

      fireTouch("touchstart", [finger(100, 120)]);
      fireTouch("touchstart", [finger(100, 120), finger(200, 220)]);

      expect(h.state.selectedElementIds).toEqual({});
      expect(h.state.activeEmbeddable).toBeNull();
    });
  });

  describe("touchend", () => {
    it("restores the previous selection while fingers remain", () => {
      const rectangle = seedRectangle();
      act(() => {
        API.setAppState({
          selectedElementIds: {},
          previousSelectedElementIds: { [rectangle.id]: true },
        });
      });

      fireTouch("touchend", [finger(200, 220)]);

      expect(h.state.selectedElementIds).toEqual({ [rectangle.id]: true });
      expect(h.state.previousSelectedElementIds).toEqual({});
    });

    it("clears the gesture pointers when the last finger lifts", () => {
      touchDown(100, 120);
      expect(gesture.pointers.size).toBe(1);

      fireTouch("touchend", []);

      expect(gesture.pointers.size).toBe(0);
    });
  });

  describe("long press context menu", () => {
    it("opens the context menu when the finger stays still", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      touchDown(100, 120);

      expect(h.state.contextMenu).toBeNull();
      act(() => {
        vi.advanceTimersByTime(TOUCH_CTX_MENU_TIMEOUT);
      });

      expect(h.state.contextMenu).not.toBeNull();
    });

    it("does not open it for a mouse press", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
        clientX: 100,
        clientY: 120,
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
      });

      act(() => {
        vi.advanceTimersByTime(TOUCH_CTX_MENU_TIMEOUT);
      });

      expect(h.state.contextMenu).toBeNull();
    });

    it("is invalidated by a touch move", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      touchDown(100, 120);
      fireTouch("touchmove", [finger(140, 160)]);

      act(() => {
        vi.advanceTimersByTime(TOUCH_CTX_MENU_TIMEOUT);
      });

      expect(h.state.contextMenu).toBeNull();
    });

    it("re-arms on a second finger, which ends the first finger's gesture", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      touchDown(100, 120, 1);
      touchDown(200, 220, 2);

      act(() => {
        vi.advanceTimersByTime(TOUCH_CTX_MENU_TIMEOUT);
      });

      // the second press replays the first one's missing pointer up, which
      // disarms the timer, so the press re-arms it at its own position
      expect(h.state.contextMenu?.left).toBe(200);
      expect(h.state.contextMenu?.top).toBe(220);
    });

    it("is invalidated by a further finger, which arms nothing of its own", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      touchDown(100, 120, 1);
      touchDown(200, 220, 2);
      touchDown(300, 320, 3);

      act(() => {
        vi.advanceTimersByTime(TOUCH_CTX_MENU_TIMEOUT);
      });

      expect(h.state.contextMenu).toBeNull();
    });

    it("stays closed while a non-selection tool is active", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      act(() => {
        h.app.setActiveTool({ type: "rectangle" });
      });
      touchDown(100, 120);

      act(() => {
        vi.advanceTimersByTime(TOUCH_CTX_MENU_TIMEOUT);
      });

      expect(h.state.contextMenu).toBeNull();
    });

    it("is disarmed when the finger lifts", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      touchDown(100, 120);
      touchUp(100, 120);

      act(() => {
        vi.advanceTimersByTime(TOUCH_CTX_MENU_TIMEOUT);
      });

      expect(h.state.contextMenu).toBeNull();
    });
  });

  describe("a second finger during a freedraw stroke", () => {
    const startStroke = (moves: number) => {
      UI.clickTool("freedraw");
      touchDown(100, 100, 1);
      for (let i = 1; i <= moves; i++) {
        fireEvent.pointerMove(GlobalTestState.interactiveCanvas, {
          clientX: 100 + i * 5,
          clientY: 100 + i * 5,
          pointerId: 1,
          pointerType: "touch",
        });
      }
      return h.state.newElement as ExcalidrawFreeDrawElement;
    };

    it("discards a stroke shorter than 10 points", () => {
      const element = startStroke(3);
      expect(element.points.length).toBeLessThan(10);

      touchDown(300, 300, 2);

      expect(h.state.newElement).toBeNull();
      expect(h.elements.some((el) => el.id === element.id)).toBe(false);
    });

    it("finalizes a stroke of 10 points or more", () => {
      const element = startStroke(15);
      expect(element.points.length).toBeGreaterThanOrEqual(10);

      touchDown(300, 300, 2);

      expect(h.state.newElement).toBeNull();
      const finalized = h.elements.find((el) => el.id === element.id);
      expect(finalized).toBeDefined();
      expect(finalized?.isDeleted).toBe(false);
      expect(h.state.selectedElementIds[element.id]).toBeFalsy();
    });
  });

  describe("a tap with the arrow tool", () => {
    it("draws a fixed-width arrow instead of entering multi-point mode", () => {
      act(() => {
        h.app.setActiveTool({ type: "arrow" });
      });

      touchDown(200, 200);
      touchUp(200, 200);

      expect(h.state.multiElement).toBeNull();
      const arrow = h.elements[0] as ExcalidrawLinearElement;
      expect(arrow?.type).toBe("arrow");
      const fixedDeltaX = Math.min(
        (h.state.width * 0.7) / h.state.zoom.value,
        100,
      );
      expect(arrow.points).toEqual([
        [0, 0],
        [fixedDeltaX, 0],
      ]);
    });
  });

  describe("clearSelectionIfNotUsingSelection", () => {
    it("drops the selection on pointer down while a non-selection tool is active", () => {
      const rectangle = seedRectangle();
      act(() => {
        h.app.setActiveTool({ type: "bucketfill" });
      });
      API.setSelectedElements([rectangle]);
      expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

      touchDown(300, 300);

      expect(h.state.selectedElementIds).toEqual({});
      expect(h.state.selectedGroupIds).toEqual({});
      expect(h.state.editingGroupId).toBeNull();
      expect(h.state.activeEmbeddable).toBeNull();
    });

    it("keeps the selection while a selection-like tool is active", () => {
      const rectangle = seedRectangle();
      API.setSelectedElements([rectangle]);

      touchDown(rectangle.x + 50, rectangle.y + 50);

      expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
    });
  });
});

describe("touch input while non-interactive", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw interaction={false} handleKeyboardGlobally />);
  });

  it("inserts no text on a double tap", () => {
    fireTouch("touchstart", [finger(100, 120)]);
    fireTouch("touchstart", [finger(100, 120)]);

    expect(h.state.editingTextElement).toBeNull();
  });

  it("keeps the selection when a second finger lands", () => {
    const rectangle = seedRectangle();
    API.setSelectedElements([rectangle]);

    fireTouch("touchstart", [finger(100, 120)]);
    fireTouch("touchstart", [finger(100, 120), finger(200, 220)]);

    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
  });
});
