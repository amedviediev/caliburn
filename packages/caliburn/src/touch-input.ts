import {
  DOUBLE_TAP_POSITION_THRESHOLD,
  EVENT,
  TAP_TWICE_TIMEOUT,
  TOUCH_CTX_MENU_TIMEOUT,
  isIOS,
} from "@excalidraw/common";
import { makeNextSelectedElementIds } from "@excalidraw/element";
import { pointDistance, pointFrom } from "@excalidraw/math";

import { gesture } from "./pan-gesture";
import { deselectElements } from "./text-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

/**
 * The touch gestures the pointer events do not express: the double tap that
 * inserts text, the second finger that drops the selection, and the long
 * press that opens the context menu.
 *
 * Upstream keeps this state in `App.tsx` module variables (`didTapTwice`,
 * `tappedTwiceTimer`, `firstTapPosition`, `touchTimeout`,
 * `invalidateContextMenu`), which holds there only because one `App` mounts
 * per page. Caliburn's suites mount editors repeatedly against one module
 * registry, where module state would carry a half-finished gesture from one
 * editor into the next, so all five live here, per editor — instantiated
 * like the other per-editor interaction owners (`CaliburnBucketFill`,
 * `CaliburnDrawShape`).
 */
export class CaliburnTouchInput {
  constructor(private app: CaliburnEditorComponent) {}

  private didTapTwice = false;
  private tappedTwiceTimer = 0;
  private firstTapPosition: { x: number; y: number } | null = null;
  private touchTimeout = 0;
  private invalidateContextMenu = false;

  private canvas: HTMLCanvasElement | null = null;

  /**
   * NOTE touchstart, touchend events must be registered outside of the
   * template because Angular's event bindings take no listener options, and
   * these must be non-passive to prevent default on them (upstream registers
   * them outside React, which binds them passively, for the same reason).
   */
  start(canvas: HTMLCanvasElement) {
    this.stop();
    this.canvas = canvas;
    canvas.addEventListener(EVENT.TOUCH_START, this.onTouchStart, {
      passive: false,
    });
    canvas.addEventListener(EVENT.TOUCH_END, this.onTouchEnd);
  }

  stop() {
    this.canvas?.removeEventListener(EVENT.TOUCH_START, this.onTouchStart);
    this.canvas?.removeEventListener(EVENT.TOUCH_END, this.onTouchEnd);
    this.canvas = null;
    this.terminate();
  }

  /**
   * Upstream's `terminateActiveInteraction` timer resets, plus the
   * `componentWillUnmount` one (`clearTimeout(touchTimeout)`). Upstream
   * leaves `tappedTwiceTimer` armed past unmount, which is harmless for a
   * module-level timer whose callback only writes module state; this one
   * closes over an editor, so it is cleared too.
   */
  terminate = () => {
    clearTimeout(this.tappedTwiceTimer);
    this.tappedTwiceTimer = 0;
    this.resetTapTwice();
    this.resetContextMenuTimer();
  };

  /** upstream's `App.resetTapTwice` */
  private resetTapTwice = () => {
    this.didTapTwice = false;
    this.firstTapPosition = null;
  };

  onTouchStart = (event: TouchEvent) => {
    if (!this.app.isInteractionEnabled()) {
      return;
    }

    // fix for Apple Pencil Scribble (do not prevent for other devices)
    if (isIOS) {
      event.preventDefault();
    }

    if (!this.didTapTwice) {
      this.didTapTwice = true;

      if (event.touches.length === 1) {
        this.firstTapPosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      }
      clearTimeout(this.tappedTwiceTimer);
      this.tappedTwiceTimer = window.setTimeout(
        this.resetTapTwice,
        TAP_TWICE_TIMEOUT,
      );
      return;
    }

    this.app.batchCommits(() => this.handleTapTwice(event));
  };

  private handleTapTwice(event: TouchEvent) {
    // insert text only if we tapped twice with a single finger at approximately the same position
    // event.touches.length === 1 will also prevent inserting text when user's zooming
    if (
      this.didTapTwice &&
      event.touches.length === 1 &&
      this.firstTapPosition
    ) {
      const touch = event.touches[0];
      const distance = pointDistance(
        pointFrom(touch.clientX, touch.clientY),
        pointFrom(this.firstTapPosition.x, this.firstTapPosition.y),
      );

      // only create text if the second tap is within the threshold of the first tap
      // this prevents accidental text creation during dragging/selection
      if (distance <= DOUBLE_TAP_POSITION_THRESHOLD) {
        // end lasso trail and deselect elements just in case
        this.app.lassoTrail.endPath();
        deselectElements(this.app);

        this.app.handleCanvasDoubleClick({
          clientX: touch.clientX,
          clientY: touch.clientY,
          type: "touch",
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        });
      }
      this.didTapTwice = false;
      clearTimeout(this.tappedTwiceTimer);
    }

    if (event.touches.length === 2) {
      this.app.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.app.state),
        activeEmbeddable: null,
      });
    }
  }

  onTouchEnd = (event: TouchEvent) => {
    if (!this.app.isInteractionEnabled()) {
      return;
    }
    this.resetContextMenuTimer();
    if (event.touches.length > 0) {
      this.app.batchCommits(() =>
        this.app.setState({
          previousSelectedElementIds: {},
          selectedElementIds: makeNextSelectedElementIds(
            this.app.state.previousSelectedElementIds,
            this.app.state,
          ),
        }),
      );
    } else {
      gesture.pointers.clear();
    }
  };

  // set touch moving for mobile context menu
  handleTouchMove = () => {
    if (!this.app.isInteractionEnabled()) {
      return;
    }
    this.invalidateContextMenu = true;
  };

  maybeOpenContextMenuAfterPointerDownOnTouchDevices = (
    event: PointerEvent,
  ): void => {
    // deal with opening context menu on touch devices
    if (event.pointerType === "touch") {
      this.invalidateContextMenu = false;

      if (this.touchTimeout) {
        // If there's already a touchTimeout, this means that there's another
        // touch down and we are doing another touch, so we shouldn't open the
        // context menu.
        this.invalidateContextMenu = true;
      } else {
        // open the context menu with the first touch's clientX and clientY
        // if the touch is not moving
        this.touchTimeout = window.setTimeout(() => {
          this.touchTimeout = 0;
          if (!this.invalidateContextMenu) {
            this.app.handleCanvasContextMenu(event);
          }
        }, TOUCH_CTX_MENU_TIMEOUT);
      }
    }
  };

  /** upstream's `removePointer`: `if (touchTimeout) { resetContextMenuTimer() }` */
  onPointerRemoved = () => {
    if (this.touchTimeout) {
      this.resetContextMenuTimer();
    }
  };

  resetContextMenuTimer = () => {
    clearTimeout(this.touchTimeout);
    this.touchTimeout = 0;
    this.invalidateContextMenu = false;
  };
}
