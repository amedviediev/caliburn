import { EVENT, throttleRAF } from "@excalidraw/common";
import { isOverScrollBars } from "@excalidraw/excalidraw/scene/scrollbars";

import type { ScrollBars } from "@excalidraw/excalidraw/scene/types";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

/**
 * The scrollbar geometry the interactive scene last painted — upstream's
 * module-level `currentScrollBars` (`App.tsx`), refreshed from the interactive
 * renderer's callback. The hit tests below run against what was drawn rather
 * than against a recomputed layout, so they stay in step with the canvas even
 * when the scene changed after the last paint.
 */
let currentScrollBars: ScrollBars = { horizontal: null, vertical: null };

/** upstream's module-level `isDraggingScrollBar` */
let draggingScrollBar = false;

/** the hanging scrollbar drag's own teardown — upstream's `lastPointerUp` */
let lastPointerUp: (() => void) | null = null;

export const setCurrentScrollBars = (scrollBars: ScrollBars) => {
  currentScrollBars = scrollBars;
};

export const isDraggingScrollBar = () => draggingScrollBar;

/** the scrollbars under the pointer, in container-relative coords */
export const getScrollBarsAtPointer = (
  editor: CaliburnEditorComponent,
  event: { clientX: number; clientY: number },
) =>
  isOverScrollBars(
    currentScrollBars,
    event.clientX - editor.state.offsetLeft,
    event.clientY - editor.state.offsetTop,
  );

/** the slice of the pointer-down state a scrollbar drag reads & writes */
type ScrollBarDragState = Pick<PointerDownState, "scrollbars" | "lastCoords">;

/**
 * Upstream's `handleDraggingScrollBar` (`App.tsx`): returns whether the
 * pointer went down on a scrollbar and, when it did, runs the drag off its
 * own window listeners — the regular gesture never starts.
 *
 * Upstream reads the scrollbars off the pointer-down state it has already
 * built by this point in the handler; caliburn builds that state inside the
 * per-tool dispatch further down, so the same hit test is evaluated here
 * against the same event.
 */
export const handleDraggingScrollBar = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
): boolean => {
  const scrollbars = getScrollBarsAtPointer(editor, event);
  if (!(scrollbars.isOverEither && !editor.state.multiElement)) {
    return false;
  }
  draggingScrollBar = true;
  const dragState: ScrollBarDragState = {
    scrollbars,
    lastCoords: { x: event.clientX, y: event.clientY },
  };
  const onPointerMove = throttleRAF((event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    editor.batchCommits(() =>
      handlePointerMoveOverScrollbars(editor, event, dragState),
    );
  });
  const onPointerUp = (lastPointerUp = () => {
    lastPointerUp = null;
    draggingScrollBar = false;
    editor.cursor.applyForTool();
    editor.setState({
      cursorButton: "up",
    });
    editor.savePointer(event.clientX, event.clientY, "up");
    window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.removeEventListener(EVENT.POINTER_UP, onPointerUp);
    onPointerMove.flush();
  });

  window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
  window.addEventListener(EVENT.POINTER_UP, onPointerUp);
  return true;
};

/**
 * Upstream's `handlePointerMoveOverScrollbars` (`App.tsx`): returns whether
 * the move happened over either scrollbar, scrolling the viewport by the
 * pointer delta scaled by the bar's own multiplier.
 */
export const handlePointerMoveOverScrollbars = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
  pointerDownState: ScrollBarDragState,
): boolean => {
  if (pointerDownState.scrollbars.isOverHorizontal) {
    const x = event.clientX;
    const dx = x - pointerDownState.lastCoords.x;
    editor.viewport.translate({
      scrollX:
        editor.state.scrollX -
        (dx * (currentScrollBars.horizontal?.deltaMultiplier || 1)) /
          editor.state.zoom.value,
    });
    pointerDownState.lastCoords.x = x;
    return true;
  }

  if (pointerDownState.scrollbars.isOverVertical) {
    const y = event.clientY;
    const dy = y - pointerDownState.lastCoords.y;
    editor.viewport.translate({
      scrollY:
        editor.state.scrollY -
        (dy * (currentScrollBars.vertical?.deltaMultiplier || 1)) /
          editor.state.zoom.value,
    });
    pointerDownState.lastCoords.y = y;
    return true;
  }
  return false;
};

/**
 * Runs a hanging scrollbar drag's own teardown — the scrollbar half of
 * upstream's `lastPointerUp`, replayed by `maybeCleanupAfterMissingPointerUp`.
 */
export const endScrollBarSession = () => {
  lastPointerUp?.();
};

export const resetScrollBarDrag = () => {
  endScrollBarSession();
  // after the teardown, which is what clears the flag on a normal release
  draggingScrollBar = false;
  lastPointerUp = null;
};
