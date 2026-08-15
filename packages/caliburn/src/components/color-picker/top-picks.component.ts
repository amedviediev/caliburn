import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

import clsx from "clsx";

import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_PICKS,
  EVENT,
  KEYS,
  THEME,
  applyDarkModeFilter,
  isColorDark,
} from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import type { Theme } from "@excalidraw/element/types";
import type { ColorPickerType } from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";

import { CaliburnTopPicksDnD } from "./top-picks-dnd";

import type { AfterViewInit, OnDestroy } from "@angular/core";

/**
 * Angular port of upstream `ColorPicker/TopPicks.tsx` — the always-visible
 * quick-pick strip. Attribute-selector component: the host IS upstream's
 * `div.color-picker__top-picks`, which is a direct grid child of
 * `.color-picker-container`.
 *
 * Upstream wraps the strip in a radix `ContextMenu` for the reset item;
 * caliburn has no radix context-menu primitive, so the menu is written out
 * here (same `.color-picker__context-menu` / `__context-menu-item` DOM,
 * positioned at the pointer inside the strip's own stacking context rather
 * than portaled into the editor container).
 */
@Component({
  selector: "div[caliburn-top-picks]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "color-picker__top-picks",
    "[class.is-dnd-active]": "!!dragState()",
    "(contextmenu)": "onContextMenu($event)",
  },
  templateUrl: "./top-picks.component.html",
})
export class CaliburnTopPicksComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dnd = inject(CaliburnTopPicksDnD);

  readonly theme = input.required<Theme>();
  readonly type = input.required<ColorPickerType>();
  readonly activeColor = input.required<string | null>();
  readonly topPicks = input<readonly string[] | undefined>(undefined);
  /** present when the strip is user-customizable — enables the right-click
   * context menu resetting the strip to its default picks */
  readonly customizable = input(false);
  /** whether custom picks are currently applied (enables the reset item) */
  readonly isCustomized = input(false);

  readonly colorChange = output<string>();
  readonly reset = output<void>();

  protected readonly resetLabel = t("colorPicker.resetTopPicks");
  protected readonly dragState = this.dnd.dragState;
  protected readonly contextMenuOpen = signal(false);
  protected readonly contextMenuPosition = signal({ x: 0, y: 0 });

  ngAfterViewInit() {
    this.dnd.setStripEl(this.host.nativeElement);
    document.addEventListener(EVENT.POINTER_DOWN, this.onDocumentPointerDown);
    document.addEventListener(EVENT.KEYDOWN, this.onDocumentKeyDown);
  }

  ngOnDestroy() {
    this.dnd.setStripEl(null);
    document.removeEventListener(
      EVENT.POINTER_DOWN,
      this.onDocumentPointerDown,
    );
    document.removeEventListener(EVENT.KEYDOWN, this.onDocumentKeyDown);
  }

  protected readonly picks = computed(() => {
    const type = this.type();
    let colors: readonly string[] | undefined;
    if (type === "elementStroke") {
      colors = DEFAULT_ELEMENT_STROKE_PICKS;
    }
    if (type === "elementBackground") {
      colors = DEFAULT_ELEMENT_BACKGROUND_PICKS;
    }
    if (type === "canvasBackground") {
      colors = DEFAULT_CANVAS_BACKGROUND_PICKS;
    }
    // this one can overwrite defaults
    const topPicks = this.topPicks();
    if (topPicks) {
      colors = topPicks;
    }

    if (!colors) {
      console.error("Invalid type for TopPicks");
      return [];
    }

    const dark = this.theme() === THEME.DARK;
    const activeColor = this.activeColor();
    const dragState = this.dragState();

    return colors.map((color, index) => {
      const reorderOffset = this.getReorderOffset(index);
      return {
        color,
        index,
        displayColor: applyDarkModeFilter(color, dark),
        transform: reorderOffset ? `translateX(${reorderOffset}px)` : null,
        className: clsx("color-picker__button", {
          active: color === activeColor,
          "is-transparent": color === "transparent" || !color,
          "has-outline": !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD),
          "is-dnd-source":
            dragState?.origin.kind === "pick" &&
            dragState.origin.index === index,
          "is-dnd-target":
            dragState?.origin.kind === "swatch" &&
            dragState.overIndex === index,
          "is-dnd-duplicate": dragState?.duplicateIndex === index,
        }),
      };
    });
  });

  /** live preview of the reorder result — every pick translates to the slot
   * it would occupy if dropped right now */
  private getReorderOffset(index: number) {
    const dragState = this.dragState();
    if (
      !dragState ||
      dragState.origin.kind !== "pick" ||
      dragState.overIndex === null
    ) {
      return 0;
    }
    const from = dragState.origin.index;
    const to = dragState.overIndex;
    if (from === to) {
      return 0;
    }
    let newIndex = index;
    if (index === from) {
      newIndex = to;
    } else {
      if (index > from) {
        newIndex -= 1;
      }
      if (newIndex >= to) {
        newIndex += 1;
      }
    }
    return (newIndex - index) * dragState.slotSpan;
  }

  protected onPickPointerDown(
    event: PointerEvent,
    index: number,
    color: string,
  ) {
    this.dnd.startPickDrag(event, index, color);
  }

  protected onContextMenu(event: MouseEvent) {
    if (!this.customizable()) {
      return;
    }
    event.preventDefault();
    // fixed-positioned at the pointer — upstream's radix menu is portaled
    // out of the strip and popper-positioned instead
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.contextMenuOpen.set(true);
  }

  protected onResetSelected() {
    if (!this.isCustomized()) {
      return;
    }
    this.contextMenuOpen.set(false);
    this.reset.emit();
  }

  private readonly onDocumentPointerDown = (event: Event) => {
    if (!this.contextMenuOpen()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest(".color-picker__context-menu")) {
      return;
    }
    this.contextMenuOpen.set(false);
  };

  private readonly onDocumentKeyDown = (event: KeyboardEvent) => {
    if (this.contextMenuOpen() && event.key === KEYS.ESCAPE) {
      this.contextMenuOpen.set(false);
    }
  };
}
