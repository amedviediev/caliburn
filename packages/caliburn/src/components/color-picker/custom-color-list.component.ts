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

import type { Theme } from "@excalidraw/element/types";

import { CaliburnColorPickerSection } from "./color-picker-section";
import { CaliburnHotkeyLabelComponent } from "./hotkey-label.component";

/**
 * Angular port of upstream `ColorPicker/CustomColorList.tsx` — the scene's
 * most-used custom colors. Attribute-selector component: the host IS
 * upstream's `div.color-picker-content--default` grid.
 */
@Component({
  selector: "div[caliburn-custom-color-list]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "color-picker-content--default" },
  imports: [CaliburnHotkeyLabelComponent],
  templateUrl: "./custom-color-list.component.html",
})
export class CaliburnCustomColorListComponent {
  private readonly section = inject(CaliburnColorPickerSection);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly theme = input.required<Theme>();
  readonly colors = input.required<string[]>();
  readonly color = input.required<string | null>();
  readonly label = input.required<string>();

  readonly colorChange = output<string>();

  protected readonly entries = computed(() => {
    const dark = this.theme() === THEME.DARK;
    const active = this.color();
    return this.colors().map((color, index) => ({
      color,
      index,
      displayColor: applyDarkModeFilter(color, dark),
      className: clsx(
        "color-picker__button color-picker__button--large has-outline",
        {
          active: active === color,
          "is-transparent": color === "transparent" || !color,
        },
      ),
    }));
  });

  private readonly focusActive = effect(() => {
    const active = this.color();
    this.section.active();
    const index = this.entries().findIndex((entry) => entry.color === active);
    if (index === -1) {
      return;
    }
    this.host.nativeElement
      .querySelectorAll<HTMLButtonElement>("button")
      [index]?.focus();
  });

  protected select(color: string) {
    this.colorChange.emit(color);
    this.section.set("custom");
  }
}
