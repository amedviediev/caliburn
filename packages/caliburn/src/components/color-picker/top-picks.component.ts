import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";

import clsx from "clsx";

import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_PICKS,
  THEME,
  applyDarkModeFilter,
  isColorDark,
} from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";
import type { ColorPickerType } from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";

/**
 * Angular port of upstream `ColorPicker/TopPicks.tsx` — the always-visible
 * quick-pick strip. Attribute-selector component: the host IS upstream's
 * `div.color-picker__top-picks`, which is a direct grid child of
 * `.color-picker-container`.
 *
 * Upstream additionally lets the strip be customized by dragging colors onto
 * it (`topPicksDnD.tsx`) and reset through a right-click context menu; that
 * is unported here, so the `is-dnd-*` classes, the drop-outline svg and the
 * context menu are absent.
 */
@Component({
  selector: "div[caliburn-top-picks]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "color-picker__top-picks" },
  templateUrl: "./top-picks.component.html",
})
export class CaliburnTopPicksComponent {
  readonly theme = input.required<Theme>();
  readonly type = input.required<ColorPickerType>();
  readonly activeColor = input.required<string | null>();
  readonly topPicks = input<readonly string[] | undefined>(undefined);

  readonly colorChange = output<string>();

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

    return colors.map((color, index) => ({
      color,
      index,
      displayColor: applyDarkModeFilter(color, dark),
      className: clsx("color-picker__button", {
        active: color === activeColor,
        "is-transparent": color === "transparent" || !color,
        "has-outline": !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD),
      }),
    }));
  });
}
