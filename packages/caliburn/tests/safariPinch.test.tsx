import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";
import { getViewportForZoomWithScrollConstraints } from "@excalidraw/excalidraw/viewport";

import { Excalidraw } from "../src/index";
import { gesture } from "../src/pan-gesture";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render } from "./test-utils";

const mouse = new Pointer("mouse");

/**
 * jsdom has no `GestureEvent` — Safari's shape is a `UIEvent` carrying
 * `scale` and `rotation`.
 */
const gestureEvent = (type: string, scale: number) =>
  Object.assign(new UIEvent(type, { bubbles: true, cancelable: true }), {
    scale,
    rotation: 0,
  });

/** returns whether the default survived, as `fireEvent` does for wheel */
const fireGesture = (
  type: "gesturestart" | "gesturechange" | "gestureend",
  scale = 1,
  target: HTMLElement | Document = document,
) => act(() => fireEvent(target, gestureEvent(type, scale)));

const container = () => GlobalTestState.renderResult.container;

const editorContainer = () =>
  container().querySelector(".excalidraw-container") as HTMLElement;

/** the anchor `onGestureChange` zooms around */
const moveCursorTo = (clientX: number, clientY: number) => {
  fireEvent.pointerMove(document, { clientX, clientY });
};

beforeEach(() => {
  localStorage.clear();
  mouse.reset();
  gesture.pointers.clear();
  gesture.initialScale = null;
});

describe("Safari desktop pinch", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("gesturestart records the zoom the pinch started from", () => {
    act(() => {
      h.app.viewport.translate({ zoom: { value: getNormalizedZoom(1.5) } });
    });
    expect(h.state.zoom.value).toBe(1.5);

    expect(fireGesture("gesturestart")).toBe(false);
    expect(gesture.initialScale).toBe(1.5);
  });

  it("gesturechange zooms by the scale factor around the cursor", () => {
    moveCursorTo(300, 220);
    fireGesture("gesturestart");

    const initialScale = gesture.initialScale!;
    expect(initialScale).toBe(1);
    const expected = getViewportForZoomWithScrollConstraints(
      {
        viewportX: h.app.viewport.lastPosition.x,
        viewportY: h.app.viewport.lastPosition.y,
        nextZoom: getNormalizedZoom(initialScale * 2),
      },
      h.state,
    );

    expect(fireGesture("gesturechange", 2)).toBe(false);

    // the pinch doubled the zoom, anchored on the cursor: the scene point
    // under (300, 220) stays under it, so the scroll halves the offset
    expect(h.state.zoom.value).toBe(2);
    expect(h.state.scrollX).toBe(-150);
    expect(h.state.scrollY).toBe(-110);
    expect(h.state.zoom.value).toBe(expected.zoom.value);
    expect(h.state.scrollX).toBe(expected.scrollX);
    expect(h.state.scrollY).toBe(expected.scrollY);
  });

  it("gesturechange without a gesturestart does not zoom", () => {
    moveCursorTo(300, 220);

    expect(fireGesture("gesturechange", 2)).toBe(false);

    expect(h.state.zoom.value).toBe(1);
  });

  it("gestureend releases the recorded scale", () => {
    fireGesture("gesturestart");
    expect(gesture.initialScale).not.toBe(null);

    expect(fireGesture("gestureend")).toBe(false);

    expect(gesture.initialScale).toBe(null);
  });

  describe("on a touch screen (two pointers down)", () => {
    /** the two fingers of a pinch, registered by their own pointer downs */
    const twoFingersDown = () => {
      gesture.pointers.set(1, { x: 0, y: 0 });
      gesture.pointers.set(2, { x: 20, y: 20 });
    };

    it("gesturestart deselects and drops the active embeddable", () => {
      const rectangle = UI.createElement("rectangle", { x: 0, y: 0, size: 50 });
      act(() => {
        API.setAppState({
          activeEmbeddable: { element: rectangle as any, state: "active" },
        });
      });
      expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
      twoFingersDown();

      fireGesture("gesturestart");

      expect(h.state.selectedElementIds).toEqual({});
      expect(h.state.activeEmbeddable).toBe(null);
    });

    it("gesturechange leaves the viewport to the touchmove handler", () => {
      moveCursorTo(300, 220);
      twoFingersDown();
      fireGesture("gesturestart");

      fireGesture("gesturechange", 2);

      expect(h.state.zoom.value).toBe(1);
    });

    it("gestureend restores the selection the pinch cleared", () => {
      const rectangle = UI.createElement("rectangle", { x: 0, y: 0, size: 50 });
      // the pointer down that put the fingers down is what records the
      // selection the pinch is about to clear
      act(() => {
        API.setAppState({
          previousSelectedElementIds: h.state.selectedElementIds,
        });
      });
      twoFingersDown();

      fireGesture("gesturestart");
      expect(h.state.selectedElementIds).toEqual({});

      fireGesture("gestureend");

      expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
      expect(h.state.previousSelectedElementIds).toEqual({});
    });
  });
});

describe("Safari desktop pinch while navigation is disabled", () => {
  it("ignores all three gesture events", async () => {
    await render(<Excalidraw interaction={false} />);
    API.setElements([API.createElement({ type: "rectangle", x: 0, y: 0 })]);

    moveCursorTo(300, 220);

    expect(fireGesture("gesturestart")).toBe(true);
    expect(gesture.initialScale).toBe(null);

    gesture.initialScale = 1;
    expect(fireGesture("gesturechange", 2)).toBe(true);
    expect(h.state.zoom.value).toBe(1);

    expect(fireGesture("gestureend")).toBe(true);
    expect(gesture.initialScale).toBe(1);
  });

  it("prevents the browser's own pinch zoom over the editor", async () => {
    await render(<Excalidraw interaction={false} />);

    expect(fireGesture("gesturestart", 1, editorContainer())).toBe(false);
    expect(fireGesture("gesturechange", 2, editorContainer())).toBe(false);
    expect(fireGesture("gestureend", 1, editorContainer())).toBe(false);

    // outside the editor the page keeps its own pinch
    expect(fireGesture("gesturestart")).toBe(true);
  });

  it("keeps the browser's pinch zoom with enabled.browserZoom", async () => {
    await render(
      <Excalidraw interaction={{ enabled: { browserZoom: true } }} />,
    );

    expect(fireGesture("gesturestart", 1, editorContainer())).toBe(true);
    expect(fireGesture("gesturechange", 2, editorContainer())).toBe(true);
    expect(fireGesture("gestureend", 1, editorContainer())).toBe(true);
  });

  it("leaves the browser's pinch to the editor's own handlers with navigation on", async () => {
    await render(
      <Excalidraw interaction={{ enabled: { navigation: true } }} />,
    );

    moveCursorTo(300, 220);

    expect(fireGesture("gesturestart", 1, editorContainer())).toBe(false);
    expect(gesture.initialScale).toBe(h.state.zoom.value);

    fireGesture("gesturechange", 2, editorContainer());
    expect(h.state.zoom.value).toBeGreaterThan(1);
  });
});
