import { Injectable, signal } from "@angular/core";

import { colorToHex, isTransparent } from "@excalidraw/common";

/**
 * Custom (non-native) drag & drop for pinning colors to the color-picker
 * top-picks strip and reordering the strip itself.
 *
 * Implemented with pointer events + a manually rendered "ghost" swatch so we
 * control the visuals fully (native HTML5 dnd flickers and forces ugly
 * ghosting/cursors).
 *
 * Angular port of upstream `ColorPicker/topPicksDnD.tsx`: the hook's
 * `useMemo` controller becomes this service (provided per
 * `caliburn-color-picker`, as upstream provides the context per picker),
 * its `useState` becomes the `dragState` signal and its `latestRef` the
 * `config` field.
 */

const GHOST_CLASS = "excalidraw-color-dnd-ghost";
const BODY_CLASS = "excalidraw-color-dnd-active";
const DRAG_THRESHOLD = 10;
/** a fast sloppy click can travel many px — releases faster than this stay
 * clicks; the drag only starts once the pointer is held this long */
const DRAG_TIME_THRESHOLD_MS = 100;

/** value-equality of colors — normalizes notation (`#fff` vs `#ffffff` vs
 * `white`) so visually identical colors can't occupy multiple pick slots */
const isSameColor = (a: string, b: string) => {
  if (a.toLowerCase() === b.toLowerCase()) {
    return true;
  }
  const aHex = colorToHex(a);
  return aHex !== null && aHex === colorToHex(b);
};

type DragOrigin =
  // a color dragged from the picker popup (palette/shades/custom) or the
  // active-color trigger — dropping replaces the hovered pick
  | { kind: "swatch" }
  // a pick dragged from the top-picks strip itself — dropping reorders
  | { kind: "pick"; index: number };

export type TopPicksDragState = {
  color: string;
  origin: DragOrigin;
  /** hovered strip slot — the slot to replace (swatch drags) or the final
   * position (pick reorders). null while the pointer is outside the strip */
  overIndex: number | null;
  /** index of an already-pinned identical color that blocks the drop */
  duplicateIndex: number | null;
  /** signed distance between strip slot centers (for reorder preview) */
  slotSpan: number;
} | null;

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastY: number;
  /** pending delayed activation (spatial threshold crossed before the
   * temporal one) */
  activationTimer: number | null;
  color: string;
  origin: DragOrigin;
  sourceEl: HTMLElement;
  sourceRect: DOMRect;
  activated: boolean;
  ghost: HTMLDivElement | null;
  ghostW: number;
  ghostH: number;
  slotRects: DOMRect[];
  slotSpan: number;
  hitRect: { left: number; right: number; top: number; bottom: number } | null;
  overIndex: number | null;
  duplicateIndex: number | null;
};

@Injectable()
export class CaliburnTopPicksDnD {
  readonly dragState = signal<TopPicksDragState>(null);

  private config: {
    enabled: boolean;
    picks: readonly string[];
    onPicksChange: (picks: string[]) => void;
  } = { enabled: false, picks: [], onPicksChange: () => {} };

  private stripEl: HTMLElement | null = null;
  private session: DragSession | null = null;

  configure(config: {
    enabled: boolean;
    picks: readonly string[];
    onPicksChange: (picks: string[]) => void;
  }) {
    this.config = config;
  }

  get enabled() {
    return this.config.enabled;
  }

  setStripEl(el: HTMLElement | null) {
    this.stripEl = el;
  }

  startSwatchDrag(event: PointerEvent, color: string | null) {
    this.begin(event, color, { kind: "swatch" });
  }

  startPickDrag(event: PointerEvent, index: number, color: string) {
    this.begin(event, color, { kind: "pick", index });
  }

  /** cancel a drag in flight if the picker unmounts mid-drag */
  destroy() {
    this.cancelDrag(false);
  }

  private publish() {
    const session = this.session;
    if (session?.activated) {
      this.dragState.set({
        color: session.color,
        origin: session.origin,
        overIndex: session.overIndex,
        duplicateIndex: session.duplicateIndex,
        slotSpan: session.slotSpan,
      });
    } else {
      this.dragState.set(null);
    }
  }

  private measureStrip() {
    const strip = this.stripEl;
    const session = this.session;
    if (!strip || !session) {
      return false;
    }
    const buttons = Array.from(
      strip.querySelectorAll<HTMLElement>("[data-top-pick-index]"),
    ).sort(
      (a, b) => Number(a.dataset.topPickIndex) - Number(b.dataset.topPickIndex),
    );
    if (!buttons.length) {
      return false;
    }
    session.slotRects = buttons.map((button) => button.getBoundingClientRect());
    const [first, second] = session.slotRects;
    // strip is evenly spaced (space-between); sign flips under RTL
    session.slotSpan = second ? second.left - first.left : first.width + 4;
    const stripRect = strip.getBoundingClientRect();
    const padX = Math.max(Math.abs(session.slotSpan) / 2, 10);
    session.hitRect = {
      left: stripRect.left - padX,
      right: stripRect.right + padX,
      top: stripRect.top - 14,
      bottom: stripRect.bottom + 14,
    };
    return true;
  }

  private positionGhost(x: number, y: number) {
    const session = this.session;
    if (session?.ghost) {
      session.ghost.style.transform = `translate(${x - session.ghostW / 2}px, ${
        y - session.ghostH / 2
      }px)`;
    }
  }

  private setGhostSize(width: number, height: number, x: number, y: number) {
    const session = this.session;
    if (!session?.ghost) {
      return;
    }
    if (session.ghostW !== width || session.ghostH !== height) {
      session.ghostW = width;
      session.ghostH = height;
      session.ghost.style.width = `${width}px`;
      session.ghost.style.height = `${height}px`;
      this.positionGhost(x, y);
    }
  }

  private activate(x: number, y: number) {
    const session = this.session;
    if (!session) {
      return;
    }
    const { sourceRect, sourceEl, color } = session;

    const ghost = document.createElement("div");
    ghost.className = GHOST_CLASS;
    const swatch = document.createElement("div");
    swatch.className = `${GHOST_CLASS}__swatch`;
    if (isTransparent(color)) {
      swatch.classList.add("is-transparent");
    } else {
      // swatches render the theme-adjusted color (dark mode remaps colors
      // rather than CSS-filtering them) — sample the rendered color so the
      // ghost matches what the user picked up
      const rendered = getComputedStyle(sourceEl).backgroundColor;
      swatch.style.backgroundColor =
        rendered && rendered !== "rgba(0, 0, 0, 0)" ? rendered : color;
    }
    ghost.appendChild(swatch);
    document.body.appendChild(ghost);

    session.ghost = ghost;
    session.ghostW = sourceRect.width;
    session.ghostH = sourceRect.height;
    ghost.style.width = `${sourceRect.width}px`;
    ghost.style.height = `${sourceRect.height}px`;
    this.positionGhost(x, y);
    // let the spawn frame paint at rest, then "lift" (scale-up transition)
    requestAnimationFrame(() => {
      // unless the drag already ended — don't restyle a ghost that's
      // mid-flight in its release animation (or already removed)
      if (this.session?.ghost === ghost) {
        ghost.classList.add(`${GHOST_CLASS}--lifted`);
      }
    });

    document.body.classList.add(BODY_CLASS);
    session.activated = true;
    this.publish();
  }

  private hitTest(x: number, y: number) {
    const session = this.session;
    if (!session?.hitRect) {
      return;
    }
    const { hitRect, slotRects } = session;
    let overIndex: number | null = null;
    let duplicateIndex: number | null = null;

    if (
      x >= hitRect.left &&
      x <= hitRect.right &&
      y >= hitRect.top &&
      y <= hitRect.bottom
    ) {
      let best = 0;
      let bestDistance = Infinity;
      slotRects.forEach((rect, index) => {
        const distance = Math.abs(x - (rect.left + rect.width / 2));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      if (session.origin.kind === "swatch") {
        const duplicate = this.config.picks.findIndex((pick) =>
          isSameColor(pick, session.color),
        );
        if (duplicate !== -1) {
          duplicateIndex = duplicate;
        } else {
          overIndex = best;
        }
      } else {
        overIndex = best;
      }
    }

    if (
      overIndex !== session.overIndex ||
      duplicateIndex !== session.duplicateIndex
    ) {
      session.overIndex = overIndex;
      session.duplicateIndex = duplicateIndex;

      const { ghost } = session;
      if (ghost) {
        ghost.classList.toggle(`${GHOST_CLASS}--over`, overIndex !== null);
        ghost.classList.toggle(
          `${GHOST_CLASS}--blocked`,
          duplicateIndex !== null,
        );
      }
      this.publish();
    }

    // over the strip the ghost morphs to slot size to preview the landing
    if (overIndex !== null) {
      const rect = session.slotRects[overIndex];
      this.setGhostSize(rect.width, rect.height, x, y);
    } else {
      this.setGhostSize(
        session.sourceRect.width,
        session.sourceRect.height,
        x,
        y,
      );
    }
  }

  private releaseGhost(target: { rect: DOMRect | null }) {
    const session = this.session;
    if (!session?.ghost) {
      return;
    }
    const { ghost } = session;
    session.ghost = null;
    ghost.classList.add(`${GHOST_CLASS}--dropping`);
    const rect = target.rect;
    if (rect) {
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    }
    window.setTimeout(() => {
      ghost.classList.add(`${GHOST_CLASS}--fade`);
    }, 160);
    window.setTimeout(() => {
      ghost.remove();
    }, 340);
  }

  // kill any in-flight (or retargetable) reorder-preview transitions before
  // the drag state is torn down. Running CSS transitions survive both the
  // removal of the `transition` property (spec: transition-* changes don't
  // affect running transitions) and the framework's keyed DOM reorder on
  // commit — the browser retargets them, which made the picks visibly
  // re-shift on drop. Clearing the transforms with transitions disabled
  // (+ forced reflow) cancels them for good, so the commit paints the final
  // order directly.
  private settleStripInstantly() {
    const strip = this.stripEl;
    if (!strip || !this.session?.activated) {
      return;
    }
    const buttons = Array.from(
      strip.querySelectorAll<HTMLElement>("[data-top-pick-index]"),
    );
    for (const button of buttons) {
      button.style.transition = "none";
      button.style.transform = "none";
    }
    // flush the non-animated state...
    void strip.offsetWidth;
    // ...then let the stylesheet govern transitions again (next drag)
    for (const button of buttons) {
      button.style.transition = "";
    }
  }

  private suppressNextClick() {
    const suppress = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("click", suppress, { capture: true, once: true });
    window.setTimeout(() => {
      window.removeEventListener("click", suppress, { capture: true });
    }, 100);
  }

  private removeListeners() {
    window.removeEventListener("pointermove", this.onPointerMove, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    window.removeEventListener("pointercancel", this.onPointerCancel, true);
    window.removeEventListener("keydown", this.onKeyDown, true);
  }

  private dispose() {
    this.removeListeners();
    document.body.classList.remove(BODY_CLASS);
    if (this.session?.activationTimer != null) {
      window.clearTimeout(this.session.activationTimer);
    }
    this.session = null;
    this.dragState.set(null);
  }

  private cancelDrag(animate: boolean) {
    const session = this.session;
    if (!session) {
      return;
    }
    this.settleStripInstantly();
    if (session.ghost) {
      if (animate) {
        this.releaseGhost({ rect: session.sourceRect });
      } else {
        session.ghost.remove();
        session.ghost = null;
      }
    }
    this.dispose();
  }

  private tryActivate(x: number, y: number) {
    const session = this.session;
    if (!session || session.activated) {
      return;
    }
    if (!this.measureStrip()) {
      this.dispose();
      return;
    }
    this.activate(x, y);
    this.hitTest(x, y);
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    const session = this.session;
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }
    session.lastX = event.clientX;
    session.lastY = event.clientY;
    if (!session.activated) {
      if (
        Math.hypot(
          event.clientX - session.startX,
          event.clientY - session.startY,
        ) < DRAG_THRESHOLD
      ) {
        // back inside the click tolerance — a delayed activation scheduled
        // while we were beyond it no longer applies (wiggle-and-return
        // must stay a click)
        if (session.activationTimer !== null) {
          window.clearTimeout(session.activationTimer);
          session.activationTimer = null;
        }
        return;
      }
      const elapsed = performance.now() - session.startTime;
      if (elapsed < DRAG_TIME_THRESHOLD_MS) {
        // spatial threshold crossed, temporal not yet — likely a fast
        // sloppy click. Wait out the rest of the grace period; the timeout
        // covers "flick then hold still", where no further moves fire
        if (session.activationTimer === null) {
          session.activationTimer = window.setTimeout(() => {
            const current = this.session;
            if (current) {
              current.activationTimer = null;
              // the pointer may have returned inside the tolerance after
              // the last event we saw — never activate from within it
              if (
                Math.hypot(
                  current.lastX - current.startX,
                  current.lastY - current.startY,
                ) >= DRAG_THRESHOLD
              ) {
                this.tryActivate(current.lastX, current.lastY);
              }
            }
          }, DRAG_TIME_THRESHOLD_MS - elapsed);
        }
        return;
      }
      this.tryActivate(event.clientX, event.clientY);
      if (!this.session?.activated) {
        return;
      }
    }
    event.preventDefault();
    this.positionGhost(event.clientX, event.clientY);
    this.hitTest(event.clientX, event.clientY);
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const session = this.session;
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }
    if (!session.activated) {
      // never became a drag — let the regular click happen
      this.dispose();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.suppressNextClick();

    const { overIndex, origin, color, slotRects } = session;
    const { picks, onPicksChange } = this.config;

    this.settleStripInstantly();

    if (overIndex !== null) {
      if (origin.kind === "swatch") {
        if (!picks.some((pick) => isSameColor(pick, color))) {
          const next = [...picks];
          next[overIndex] = color;
          onPicksChange(next);
        }
      } else if (origin.index !== overIndex) {
        const next = [...picks];
        const [moved] = next.splice(origin.index, 1);
        next.splice(overIndex, 0, moved);
        onPicksChange(next);
      }
      this.releaseGhost({ rect: slotRects[overIndex] });
    } else {
      this.releaseGhost({ rect: session.sourceRect });
    }
    this.dispose();
  };

  private readonly onPointerCancel = (event: PointerEvent) => {
    if (this.session && event.pointerId === this.session.pointerId) {
      this.cancelDrag(true);
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.session?.activated && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.cancelDrag(true);
    }
  };

  private begin(event: PointerEvent, color: string | null, origin: DragOrigin) {
    if (!this.config.enabled || this.session || event.button !== 0 || !color) {
      return;
    }
    const sourceEl = event.currentTarget as HTMLElement;
    this.session = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      lastX: event.clientX,
      lastY: event.clientY,
      activationTimer: null,
      color,
      origin,
      sourceEl,
      sourceRect: sourceEl.getBoundingClientRect(),
      activated: false,
      ghost: null,
      ghostW: 0,
      ghostH: 0,
      slotRects: [],
      slotSpan: 0,
      hitRect: null,
      overIndex: null,
      duplicateIndex: null,
    };
    window.addEventListener("pointermove", this.onPointerMove, true);
    window.addEventListener("pointerup", this.onPointerUp, true);
    window.addEventListener("pointercancel", this.onPointerCancel, true);
    window.addEventListener("keydown", this.onKeyDown, true);
  }
}
