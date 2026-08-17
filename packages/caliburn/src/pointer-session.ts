import { EVENT } from "@excalidraw/common";

import type { CaliburnEditorComponent } from "./editor.component";

type PointerSession = {
  editor: CaliburnEditorComponent;
  /** replayed as the pointer up when the real one never arrives */
  downEvent: PointerEvent;
  onMove: (event: PointerEvent) => void;
  onUp: (event: PointerEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
};

/**
 * The window-level listeners upstream installs for the duration of one
 * pointer gesture (`App.tsx`'s `onPointerMoveFromPointerDownHandler` /
 * `onPointerUpFromPointerDownHandler` and the keyboard pair beside them), so
 * a drag released over the UI — or outside the browser viewport — still
 * completes, and a modifier pressed mid-drag takes effect without a move.
 * Module-level, like the pan session's own state in `pan-gesture.ts`: one
 * gesture is live at a time.
 */
let session: PointerSession | null = null;

let canvasHandledEvent: Event | null = null;

/**
 * Pointer events over the interactive canvas reach both its own binding and,
 * as they bubble, the session's window listeners. The canvas binding runs
 * first and does the work; recording the event here lets the window listeners
 * skip it instead of processing the gesture twice.
 */
export const markCanvasHandledPointerEvent = (event: PointerEvent) => {
  canvasHandledEvent = event;
};

export const startPointerSession = (
  editor: CaliburnEditorComponent,
  downEvent: PointerEvent,
) => {
  endPointerSession();

  const onMove = (event: PointerEvent) => {
    if (event === canvasHandledEvent) {
      return;
    }
    editor.handlePointerMoveFromPointerDown(event);
  };
  const onUp = (event: PointerEvent) => {
    if (event === canvasHandledEvent) {
      return;
    }
    endPointerSession();
    editor.handlePointerUpFromPointerDown(event);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    editor.handleKeyDownFromPointerDown(event);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    editor.handleKeyUpFromPointerDown(event);
  };

  session = { editor, downEvent, onMove, onUp, onKeyDown, onKeyUp };
  window.addEventListener(EVENT.POINTER_MOVE, onMove);
  window.addEventListener(EVENT.POINTER_UP, onUp);
  window.addEventListener(EVENT.KEYDOWN, onKeyDown);
  window.addEventListener(EVENT.KEYUP, onKeyUp);
};

export const endPointerSession = () => {
  if (!session) {
    return;
  }
  window.removeEventListener(EVENT.POINTER_MOVE, session.onMove);
  window.removeEventListener(EVENT.POINTER_UP, session.onUp);
  window.removeEventListener(EVENT.KEYDOWN, session.onKeyDown);
  window.removeEventListener(EVENT.KEYUP, session.onKeyUp);
  session = null;
};

/**
 * Runs the hanging gesture's pointer-up teardown — upstream's
 * `missingPointerEventCleanupEmitter`, which replays the handler with the
 * supplied event or, when there is none, with the gesture's own pointer-DOWN
 * event.
 */
export const replayPointerSessionUp = (event: PointerEvent | null) => {
  const hanging = session;
  if (!hanging) {
    return;
  }
  endPointerSession();
  hanging.editor.handlePointerUpFromPointerDown(event ?? hanging.downEvent);
};
