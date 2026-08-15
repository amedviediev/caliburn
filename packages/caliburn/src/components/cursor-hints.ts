import { ARROW_TYPE } from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { CaliburnEditorComponent } from "../editor.component";

/** how long the hint stays visible before it starts fading out */
export const CURSOR_HINT_DURATION = 700;
/** fade-out duration (keep in sync with CursorHint.scss) */
export const CURSOR_HINT_FADE_DURATION = 100;
/** distance from the pointer so the hint isn't covered by the cursor */
export const CURSOR_HINT_GAP = 16;

/**
 * While a recently shown hint is still fresh in memory, tool-switch hints
 * are suppressed (repeatedly re-picking a tool you just used doesn't need
 * the reminder). Cycling arrow types and numeric shortcuts bypass this.
 */
export const CURSOR_HINT_COOLDOWN = 5 * 60 * 1000;

/** the view `CursorHints` drives; the component registers itself as one */
export interface CursorHintView {
  show: (icon: string) => void;
}

const getArrowTypeIcon = (arrowType: AppState["currentItemArrowType"]) =>
  arrowType === ARROW_TYPE.elbow
    ? "elbowArrowIcon"
    : arrowType === ARROW_TYPE.round
    ? "roundArrowIcon"
    : "sharpArrowIcon";

/**
 * Owns the cursor-hint policy. The editor reports semantic interaction
 * events (what the user did); all decisions about whether and what to show —
 * cooldown, bypasses, hint content — are made here.
 *
 * Upstream keeps the shown hint in a jotai atom the component subscribes to
 * (`cursorHintAtom`); here the mounted component registers itself as the
 * view, so showing a hint stays synchronous with the handler that triggered
 * it (upstream's React render is likewise flushed within the same event).
 * The hint content is an `<ng-icon>` registry name rather than upstream's
 * React node, as everywhere else in caliburn.
 *
 * Lives outside `cursor-hint.component.ts` so the editor can construct it
 * without a module cycle through that file's `@Component`.
 */
export class CursorHints {
  private app: CaliburnEditorComponent;
  private lastShownAt = 0;

  constructor(app: CaliburnEditorComponent) {
    this.app = app;
  }

  /**
   * Shows a transient tooltip next to the cursor, hidden automatically
   * after a short delay. Repeated calls replace the content and restart
   * the timer.
   */
  show = (icon: string) => {
    // `viewport.lastPosition` stays at its initial (0, 0) until the first
    // pointermove, so in pointer-less flows (e.g. keyboard-only session so
    // far) we don't know where to show the hint — don't show it at all
    const { x, y } = this.app.viewport.lastPosition;
    if (x === 0 && y === 0) {
      return;
    }
    this.lastShownAt = Date.now();
    this.app.cursorHintView?.show(icon);
  };

  private isOnCooldown = () =>
    Date.now() - this.lastShownAt < CURSOR_HINT_COOLDOWN;

  /** arrow type cycled via shortcut (arrow tool already active) */
  onArrowTypeCycled = (arrowType: AppState["currentItemArrowType"]) => {
    // always worth hinting — you need to see what you switched to
    this.show(getArrowTypeIcon(arrowType));
  };

  /** arrow/line tool picked via keyboard shortcut */
  onToolShortcut = (tool: "arrow" | "line", source: "letter" | "digit") => {
    // digit shortcuts always hint (often pressed blind, without certainty
    // which tool the digit maps to); letter shortcuts only after a
    // cooldown — re-picking a tool you used moments ago doesn't need the
    // reminder
    if (source === "digit" || !this.isOnCooldown()) {
      this.show(
        tool === "line"
          ? "lineIcon"
          : getArrowTypeIcon(this.app.state.currentItemArrowType),
      );
    }
  };
}
