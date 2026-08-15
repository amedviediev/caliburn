import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  viewChild,
} from "@angular/core";

import {
  EVENT,
  KEYS,
  THEME,
  arrayToMap,
  isColorDark,
  removeDarkModeFilter,
  rgbToHex,
} from "@excalidraw/common";
import { ShapeCache, mutateElement } from "@excalidraw/element";

import { getSelectedElements } from "@excalidraw/excalidraw/scene";

import { positionElementBesideCursor } from "@excalidraw/excalidraw/components/positionElementBesideCursor";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { eyeDropperCursor } from "./eye-dropper";

import type { CaliburnEditorComponent } from "../editor.component";
import type { EyeDropperProperties } from "./eye-dropper";

import type { ElementRef, AfterViewInit, OnDestroy } from "@angular/core";

/**
 * Angular port of upstream `EyeDropper.tsx` — the full-editor backdrop that
 * samples the static canvas under the cursor and previews the colour in a
 * bubble beside it. Upstream renders the preview through a portal into the
 * `.excalidraw-eye-dropper-container` div; here the component is written
 * inside that div directly, producing the same DOM
 * (container > backdrop > preview).
 *
 * Upstream's `onCancel` / `onChange` / `onSelect` props are supplied by
 * `LayerUI.tsx`; with no portal in between there is nowhere for caliburn to
 * pass them from, so those three bodies live here.
 */
@Component({
  selector: "caliburn-eye-dropper",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./eye-dropper.component.html",
})
export class CaliburnEyeDropperComponent implements AfterViewInit, OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private readonly backdropRef =
    viewChild.required<ElementRef<HTMLDivElement>>("backdrop");

  private readonly previewRef =
    viewChild.required<ElementRef<HTMLDivElement>>("preview");

  protected readonly cursor = eyeDropperCursor;
  protected readonly isPhone =
    this.editor.editorInterface.formFactor === "phone";

  private isHoldingPointerDown = false;

  protected isDarkTheme() {
    this.editor.changeGeneration();
    return this.editor.state.theme === THEME.DARK;
  }

  ngAfterViewInit() {
    // focus the backdrop so it can listen on keydown events
    this.backdropRef().nativeElement.focus();

    // init color preview else it would show only after the first mouse move
    this.onPointerMove({
      clientX: this.editor.viewport.lastPosition.x,
      clientY: this.editor.viewport.lastPosition.y,
      altKey: false,
    } as PointerEvent);

    window.addEventListener(EVENT.POINTER_MOVE, this.onPointerMove, {
      passive: true,
    });
    window.addEventListener(EVENT.BLUR, this.onCancel);
    document.addEventListener(EVENT.POINTER_DOWN, this.onOutsidePointerDown);
    document.addEventListener(EVENT.TOUCH_START, this.onOutsidePointerDown);
  }

  ngOnDestroy() {
    this.isHoldingPointerDown = false;
    window.removeEventListener(EVENT.POINTER_MOVE, this.onPointerMove);
    window.removeEventListener(EVENT.BLUR, this.onCancel);
    document.removeEventListener(EVENT.POINTER_DOWN, this.onOutsidePointerDown);
    document.removeEventListener(EVENT.TOUCH_START, this.onOutsidePointerDown);
  }

  protected onKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.onCancel();
    }
  }

  protected onPointerDown(event: PointerEvent) {
    this.isHoldingPointerDown = true;
    // NOTE we can't event.preventDefault() as that would stop
    // pointermove events
    event.stopImmediatePropagation();
  }

  protected onPointerUp(event: PointerEvent) {
    this.isHoldingPointerDown = false;

    // since we're not preventing default on pointerdown, the focus would
    // goes back to `body` so we want to refocus the editor container instead
    this.editor.excalidrawContainerValue.container?.focus();

    event.stopImmediatePropagation();
    event.preventDefault();

    this.onSelect(this.getColorToApply(this.getCurrentColor(event)), event);
  }

  private readonly onOutsidePointerDown = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        ".excalidraw-eye-dropper-trigger, .excalidraw-eye-dropper-backdrop",
      )
    ) {
      return;
    }
    this.onCancel();
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const preview = this.previewRef().nativeElement;
    const backdrop = this.backdropRef().nativeElement;

    const { top, left } = positionElementBesideCursor({
      cursor: { x: event.clientX, y: event.clientY },
      element: {
        width: preview.offsetWidth,
        height: preview.offsetHeight,
      },
      container: backdrop.getBoundingClientRect(),
      gap: 7,
    });

    preview.style.top = `${top}px`;
    preview.style.left = `${left}px`;

    const currentColor = this.getCurrentColor(event);

    if (this.isHoldingPointerDown) {
      this.onChange(this.getColorToApply(currentColor), event.altKey);
    }

    preview.style.background = currentColor;
    preview.style.setProperty(
      "--eye-dropper-preview-border-color",
      isColorDark(currentColor) ? "#fff" : "#222",
    );
  };

  private getCurrentColor({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }) {
    const ctx = this.editor.canvas.getContext("2d")!;
    const pixel = ctx.getImageData(
      (clientX - this.editor.state.offsetLeft) * window.devicePixelRatio,
      (clientY - this.editor.state.offsetTop) * window.devicePixelRatio,
      1,
      1,
    ).data;

    return rgbToHex(pixel[0], pixel[1], pixel[2]);
  }

  private getColorToApply(color: string) {
    return this.editor.state.theme === THEME.DARK
      ? removeDarkModeFilter(color)
      : color;
  }

  private get state(): EyeDropperProperties | null {
    return this.editor.activeEyeDropper();
  }

  /** upstream `LayerUI.tsx`'s `onCancel` */
  private readonly onCancel = () => {
    this.editor.batchCommits(() => {
      this.editor.activeEyeDropper.set(null);
      this.editor.setState({});
    });
  };

  /** upstream `LayerUI.tsx`'s `onChange` — the live alt-drag preview */
  private onChange(color: string, altKey: boolean) {
    const state = this.state;
    if (!state) {
      return;
    }
    const colorPickerType = state.colorPickerType;
    if (
      colorPickerType !== "elementBackground" &&
      colorPickerType !== "elementStroke"
    ) {
      return;
    }

    const elements = this.editor.scene.getNonDeletedElements();
    const selectedElements = getSelectedElements(elements, this.editor.state);

    if (selectedElements.length) {
      for (const element of selectedElements) {
        mutateElement(element, arrayToMap(elements), {
          [altKey && state.swapPreviewOnAlt
            ? colorPickerType === "elementBackground"
              ? "strokeColor"
              : "backgroundColor"
            : colorPickerType === "elementBackground"
            ? "backgroundColor"
            : "strokeColor"]: color,
        });
        ShapeCache.delete(element);
      }
      this.editor.scene.triggerUpdate();
    } else if (colorPickerType === "elementBackground") {
      this.editor.setState({ currentItemBackgroundColor: color });
    } else {
      this.editor.setState({ currentItemStrokeColor: color });
    }
  }

  /** upstream `LayerUI.tsx`'s `onSelect` */
  private onSelect(color: string, event: PointerEvent) {
    const state = this.state;
    this.editor.batchCommits(() => {
      this.editor.activeEyeDropper.set(
        state?.keepOpenOnAlt && event.altKey ? state : null,
      );
      state?.onSelect?.(color, event);
      this.editor.setState({});
    });
  }
}
