import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
} from "@angular/core";

import clsx from "clsx";

import { THEME, applyDarkModeFilter } from "@excalidraw/common";

import { getColorNameAndShadeFromColor } from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ColorPaletteCustom } from "@excalidraw/common";
import type { Theme } from "@excalidraw/element/types";

import { translated } from "../../i18n";

import { CaliburnColorPickerSection } from "./color-picker-section";
import { CaliburnHotkeyLabelComponent } from "./hotkey-label.component";

/**
 * Angular port of upstream `ColorPicker/ShadeList.tsx`. Attribute-selector
 * component: the host IS upstream's `div.color-picker-content--default`,
 * which also carries the `shades` modifier / the no-shades placeholder's
 * inline positioning.
 */
@Component({
  selector: "div[caliburn-shade-list]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "color-picker-content--default",
    "[class.shades]": "shades()",
    "[style.position]": "shades() ? null : 'relative'",
    "[attr.tabindex]": "shades() ? null : -1",
  },
  imports: [CaliburnHotkeyLabelComponent],
  templateUrl: "./shade-list.component.html",
})
export class CaliburnShadeListComponent {
  private readonly section = inject(CaliburnColorPickerSection);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly theme = input.required<Theme>();
  readonly color = input.required<string | null>();
  readonly palette = input.required<ColorPaletteCustom>();
  readonly showHotKey = input(false);

  readonly colorChange = output<string>();

  protected readonly noShadesLabel = translated(() =>
    t("colorPicker.noShades"),
  );

  private readonly colorObj = computed(() =>
    getColorNameAndShadeFromColor({
      color: this.color() || "transparent",
      palette: this.palette(),
    }),
  );

  protected readonly shades = computed(() => {
    const colorObj = this.colorObj();
    if (!colorObj) {
      return null;
    }
    const shades = this.palette()[colorObj.colorName];
    if (!Array.isArray(shades)) {
      return null;
    }
    const dark = this.theme() === THEME.DARK;
    return shades.map((color, index) => ({
      color,
      index,
      displayColor: applyDarkModeFilter(color, dark),
      className: clsx("color-picker__button color-picker__button--large", {
        active: index === colorObj.shade,
      }),
      title: `${colorObj.colorName} - ${index + 1}`,
    }));
  });

  private readonly focusActive = effect(() => {
    const colorObj = this.colorObj();
    const shades = this.shades();
    if (
      this.section.active() !== "shades" ||
      !shades ||
      colorObj?.shade == null
    ) {
      return;
    }
    this.host.nativeElement
      .querySelectorAll<HTMLButtonElement>("button")
      [colorObj.shade]?.focus();
  });

  protected select(color: string) {
    this.colorChange.emit(color);
    this.section.set("shades");
  }
}
