import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  inject,
  signal,
} from "@angular/core";
import { NgIcon } from "@ng-icons/core";

import { EVENT } from "@excalidraw/common";

import { positionElementBesideCursor } from "@excalidraw/excalidraw/components/positionElementBesideCursor";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import {
  CURSOR_HINT_DURATION,
  CURSOR_HINT_FADE_DURATION,
  CURSOR_HINT_GAP,
} from "./cursor-hints";

import type { CursorHintView } from "./cursor-hints";
import type { CaliburnEditorComponent } from "../editor.component";

import type { OnDestroy } from "@angular/core";

/**
 * Transient tooltip shown next to the cursor for added affordance after
 * actions that have no other visual feedback near the pointer (e.g. cycling
 * arrow types via shortcut). Trigger via `app.cursorHints`.
 */
@Component({
  selector: "caliburn-cursor-hint",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  templateUrl: "./cursor-hint.component.html",
})
export class CaliburnCursorHintComponent implements CursorHintView, OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly hint = signal<{ icon: string; nonce: number } | null>(
    null,
  );
  protected readonly isFadingOut = signal(false);

  private fadeTimer = 0;
  private hideTimer = 0;

  constructor() {
    this.editor.cursorHintView = this;
    window.addEventListener(EVENT.POINTER_MOVE, this.onPointerMove);
    // hide immediately when the user starts interacting (e.g. drawing)
    // so the hint doesn't get in the way
    window.addEventListener(EVENT.POINTER_DOWN, this.onPointerDown, {
      capture: true,
    });
  }

  ngOnDestroy() {
    window.removeEventListener(EVENT.POINTER_MOVE, this.onPointerMove);
    window.removeEventListener(EVENT.POINTER_DOWN, this.onPointerDown, {
      capture: true,
    });
    this.clearTimers();
    if (this.editor.cursorHintView === this) {
      this.editor.cursorHintView = null;
    }
  }

  show(icon: string) {
    this.clearTimers();
    this.isFadingOut.set(false);
    // unique per trigger so a re-trigger restarts the fade-in animation
    this.hint.set({ icon, nonce: Math.random() });
    // render before measuring — the element has to exist for its size to be
    // read (upstream positions from a layout effect, after its own commit)
    this.cdr.detectChanges();
    this.updatePosition(
      this.editor.viewport.lastPosition.x,
      this.editor.viewport.lastPosition.y,
    );

    this.fadeTimer = window.setTimeout(() => {
      this.isFadingOut.set(true);
      this.cdr.detectChanges();
    }, CURSOR_HINT_DURATION);
    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, CURSOR_HINT_DURATION + CURSOR_HINT_FADE_DURATION);
  }

  private hide() {
    this.clearTimers();
    if (this.hint()) {
      this.hint.set(null);
      this.cdr.detectChanges();
    }
  }

  private clearTimers() {
    window.clearTimeout(this.fadeTimer);
    window.clearTimeout(this.hideTimer);
  }

  private readonly onPointerDown = () => {
    this.hide();
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.hint()) {
      return;
    }
    this.updatePosition(event.clientX, event.clientY);
  };

  private updatePosition(clientX: number, clientY: number) {
    const container = this.editor.excalidrawContainerValue.container;
    const element =
      this.host.nativeElement.querySelector<HTMLElement>(".CursorHint");
    if (!element || !container) {
      return;
    }

    const { left, top } = positionElementBesideCursor({
      cursor: { x: clientX, y: clientY },
      element: {
        width: element.offsetWidth,
        height: element.offsetHeight,
      },
      container: container.getBoundingClientRect(),
      gap: CURSOR_HINT_GAP,
    });

    element.style.transform = `translate(${left}px, ${top}px)`;
  }
}
