import {
  CURSOR_TYPE,
  EVENT,
  POINTER_BUTTON,
  throttleRAF,
} from "@excalidraw/common";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";
import { getCenter, getDistance } from "@excalidraw/excalidraw/gesture";
import { getViewportForZoomWithScrollConstraints } from "@excalidraw/excalidraw/viewport";
import { isHandToolActive } from "@excalidraw/excalidraw/appState";
import { makeNextSelectedElementIds } from "@excalidraw/element";

import type { Gesture, GestureEvent } from "@excalidraw/excalidraw/types";

import type { CaliburnEditorComponent } from "./editor.component";

export const gesture: Gesture = {
  pointers: new Map(),
  lastCenter: null,
  initialDistance: null,
  initialScale: null,
};

let isPanning = false;

let holdingSpace = false;

export const isGestureActive = () => gesture.pointers.size >= 2 || isPanning;

/** whether a pan session is in flight (upstream's module-level `isPanning`) */
export const isPanSessionActive = () => isPanning;

/**
 * Whether the space bar is held down — the modifier that turns a primary
 * drag into a pan, whatever the active tool. Module-level like `isPanning`,
 * as upstream's `App.tsx` keeps it.
 */
export const isHoldingSpace = () => holdingSpace;

export const setHoldingSpace = (holding: boolean) => {
  holdingSpace = holding;
};

let lastPointerUp: (() => void) | null = null;

// Returns whether the event is a panning
export const handleCanvasPanUsingWheelOrSpaceDrag = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
): boolean => {
  if (
    !(
      gesture.pointers.size <= 1 &&
      (((event.button === POINTER_BUTTON.WHEEL ||
        (event.button === POINTER_BUTTON.MAIN &&
          (holdingSpace || isHandToolActive(editor.state)))) &&
        // reachable while non-interactive when the active tool is allowed
        // via `interaction.enabled.tools` — panning must stay gated on
        // `navigation` then
        (editor.isInteractionEnabled() || editor.isNavigationEnabled())) ||
        (editor.state.viewModeEnabled &&
          !editor.isActiveToolPointerCapturing()))
    )
  ) {
    return false;
  }
  isPanning = true;

  // due to event.preventDefault below, container wouldn't get focus
  // automatically
  editor.focusContainer();

  // preventing defualt while text editing messes with cursor/focus
  if (!editor.state.editingTextElement) {
    // necessary to prevent browser from scrolling the page if excalidraw
    // not full-page #4489
    //
    // as such, the above is broken when panning canvas while in wysiwyg
    event.preventDefault();
  }

  editor.cursor.set(CURSOR_TYPE.GRABBING);
  let { clientX: lastX, clientY: lastY } = event;
  const onPointerMove = throttleRAF((event: PointerEvent) => {
    const deltaX = lastX - event.clientX;
    const deltaY = lastY - event.clientY;
    lastX = event.clientX;
    lastY = event.clientY;

    editor.viewport.translate({
      scrollX: editor.state.scrollX - deltaX / editor.state.zoom.value,
      scrollY: editor.state.scrollY - deltaY / editor.state.zoom.value,
    });
  });
  const teardown = (lastPointerUp = () => {
    lastPointerUp = null;
    isPanning = false;
    if (!holdingSpace) {
      editor.cursor.reset();
    }
    editor.setState(
      {
        cursorButton: "up",
      },
      // Runs after the trailing throttled pointer move has committed, so
      // the snap-back starts from the pan's actual final viewport.
      editor.viewport.releaseOverscroll,
    );
    editor.savePointer(event.clientX, event.clientY, "up");
    window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.removeEventListener(EVENT.POINTER_UP, teardown);
    window.removeEventListener(EVENT.BLUR, teardown);
    onPointerMove.flush();
  });
  window.addEventListener(EVENT.BLUR, teardown);
  window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, {
    passive: true,
  });
  window.addEventListener(EVENT.POINTER_UP, teardown);
  return true;
};

export const updateGestureOnPointerDown = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
): void => {
  gesture.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });

  if (gesture.pointers.size === 2) {
    gesture.lastCenter = getCenter(gesture.pointers);
    gesture.initialScale = editor.state.zoom.value;
    gesture.initialDistance = getDistance(
      Array.from(gesture.pointers.values()),
    );
  }
};

/**
 * Tracks the pointer within the ongoing multi-touch gesture and applies
 * the two-finger pinch zoom/pan, if any.
 */
export const updateMultiTouchGesture = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
) => {
  if (gesture.pointers.has(event.pointerId)) {
    gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  const initialScale = gesture.initialScale;
  if (
    gesture.pointers.size === 2 &&
    gesture.lastCenter &&
    initialScale &&
    gesture.initialDistance
  ) {
    const center = getCenter(gesture.pointers);
    const deltaX = center.x - gesture.lastCenter.x;
    const deltaY = center.y - gesture.lastCenter.y;
    gesture.lastCenter = center;

    const distance = getDistance(Array.from(gesture.pointers.values()));
    const scaleFactor =
      editor.state.activeTool.type === "freedraw" && editor.state.penMode
        ? 1
        : distance / gesture.initialDistance;

    const nextZoom = scaleFactor
      ? getNormalizedZoom(initialScale * scaleFactor)
      : editor.state.zoom.value;

    editor.setState((state) => {
      // Preserve any existing screen-space overscroll through the zoom,
      // then apply this frame's pan delta on top. `viewport.translate`
      // rubberband-clamps the combined result against the scroll lock.
      const zoomedViewport = getViewportForZoomWithScrollConstraints(
        {
          viewportX: center.x,
          viewportY: center.y,
          nextZoom,
        },
        state,
      );
      const zoomValue = zoomedViewport.zoom.value;

      editor.viewport.translate(
        {
          zoom: zoomedViewport.zoom,
          // 2x multiplier is just a magic number that makes this work correctly
          // on touchscreen devices (note: if we get report that panning is slower/faster
          // than actual movement, consider swapping with devicePixelRatio)
          scrollX: zoomedViewport.scrollX + (2 * deltaX) / zoomValue,
          scrollY: zoomedViewport.scrollY + (2 * deltaY) / zoomValue,
          shouldCacheIgnoreZoom: true,
        },
        { zoomPreConstrained: true },
      );

      return null;
    });
  } else {
    gesture.lastCenter = gesture.initialDistance = gesture.initialScale = null;
  }
};

/**
 * returns whether user is making a gesture with >= 2 fingers (points)
 * on o touch screen (not on a trackpad). Currently only relates to Darwin
 * (iOS/iPadOS,MacOS), but may work on other devices in the future if
 * GestureEvent is standardized.
 */
const isTouchScreenMultiTouchGesture = () => {
  // we don't want to deselect when using trackpad, and multi-point gestures
  // only work on touch screens, so checking for >= pointers means we're on a
  // touchscreen
  return gesture.pointers.size >= 2;
};

// fires only on Safari
export const onGestureStart = (
  editor: CaliburnEditorComponent,
  event: GestureEvent,
) => {
  if (!editor.isNavigationEnabled()) {
    return;
  }
  event.preventDefault();

  // we only want to deselect on touch screens because user may have selected
  // elements by mistake while zooming
  if (isTouchScreenMultiTouchGesture()) {
    editor.setState({
      selectedElementIds: makeNextSelectedElementIds({}, editor.state),
      activeEmbeddable: null,
    });
  }
  gesture.initialScale = editor.state.zoom.value;
};

// fires only on Safari
export const onGestureChange = (
  editor: CaliburnEditorComponent,
  event: GestureEvent,
) => {
  if (!editor.isNavigationEnabled()) {
    return;
  }
  event.preventDefault();

  // onGestureChange only has zoom factor but not the center.
  // If we're on iPad or iPhone, then we recognize multi-touch and will
  // zoom in at the right location in the touchmove handler
  // (handleCanvasPointerMove).
  //
  // On Macbook trackpad, we don't have those events so will zoom in at the
  // current location instead.
  //
  // As such, bail from this handler on touch devices.
  if (isTouchScreenMultiTouchGesture()) {
    return;
  }

  const initialScale = gesture.initialScale;
  if (initialScale) {
    editor.viewport.translate(
      (state) => ({
        ...getViewportForZoomWithScrollConstraints(
          {
            viewportX: editor.viewport.lastPosition.x,
            viewportY: editor.viewport.lastPosition.y,
            nextZoom: getNormalizedZoom(initialScale * event.scale),
          },
          state,
        ),
      }),
      {
        zoomPreConstrained: true,
        preserveScrollConstraintsSnapBack: true,
      },
    );
  }
};

// fires only on Safari
export const onGestureEnd = (
  editor: CaliburnEditorComponent,
  event: GestureEvent,
) => {
  if (!editor.isNavigationEnabled()) {
    return;
  }
  event.preventDefault();
  // reselect elements only on touch screens (see onGestureStart)
  if (isTouchScreenMultiTouchGesture()) {
    editor.setState({
      previousSelectedElementIds: {},
      selectedElementIds: makeNextSelectedElementIds(
        editor.state.previousSelectedElementIds,
        editor.state,
      ),
    });
  }
  gesture.initialScale = null;
};

export const removePointer = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
) => {
  editor.touchInput.onPointerRemoved();

  if (event.type === "pointercancel") {
    // the browser took the pointer over (scroll, palm rejection) — no
    // pointerup will follow, so the armed bucket fill must not commit
    editor.bucketFill.cancel();
  }

  const wasMultiTouchGesture = gesture.pointers.size >= 2;
  gesture.pointers.delete(event.pointerId);

  // the multi-touch viewport gesture just disengaged: release the
  // rubberband that was withheld while it was active
  // (see `snapBackToScrollConstraints`)
  if (
    wasMultiTouchGesture &&
    gesture.pointers.size < 2 &&
    editor.state.scrollConstraints
  ) {
    editor.viewport.releaseOverscroll();
  }
};

/**
 * Runs a hanging pan session's own teardown — upstream's module-level
 * `lastPointerUp`, replayed by `maybeCleanupAfterMissingPointerUp`.
 */
export const endPanSession = () => {
  lastPointerUp?.();
};

export const resetGesture = () => {
  isPanning = false;
  endPanSession();
  // after the teardown, which reads it: upstream likewise clears the flag
  // only once the hanging pan has run its own (space-aware) cleanup
  holdingSpace = false;
  gesture.pointers.clear();
  gesture.lastCenter = null;
  gesture.initialDistance = null;
  gesture.initialScale = null;
};
