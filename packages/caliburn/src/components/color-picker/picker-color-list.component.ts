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

import { THEME, applyDarkModeFilter, isColorDark } from "@excalidraw/common";

import {
  colorPickerHotkeyBindings,
  getColorNameAndShadeFromColor,
} from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ColorPaletteCustom } from "@excalidraw/common";
import type { Theme } from "@excalidraw/element/types";
import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

import { CaliburnColorPickerSection } from "./color-picker-section";
import { CaliburnTopPicksDnD } from "./top-picks-dnd";
import { CaliburnHotkeyLabelComponent } from "./hotkey-label.component";

interface PaletteEntry {
  key: string;
  excluded: boolean;
  color: string;
  displayColor: string;
  keybinding: string;
  className: string;
  title: string;
  ariaLabel: string;
}

/**
 * Angular port of upstream `ColorPicker/PickerColorList.tsx`.
 * Attribute-selector component: the host IS upstream's
 * `div.color-picker-content--default` grid.
 */
@Component({
  selector: "div[caliburn-picker-color-list]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "color-picker-content--default" },
  imports: [CaliburnHotkeyLabelComponent],
  templateUrl: "./picker-color-list.component.html",
})
export class CaliburnPickerColorListComponent {
  private readonly section = inject(CaliburnColorPickerSection);
  private readonly dnd = inject(CaliburnTopPicksDnD);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly theme = input.required<Theme>();
  readonly palette = input.required<ColorPaletteCustom>();
  readonly color = input.required<string | null>();
  readonly activeShade = input.required<number>();
  readonly showHotKey = input(true);
  readonly excludedColors = input<readonly string[] | undefined>(undefined);

  readonly colorChange = output<string>();

  private readonly colorObj = computed(() =>
    getColorNameAndShadeFromColor({
      color: this.color(),
      palette: this.palette(),
    }),
  );

  protected readonly entries = computed<PaletteEntry[]>(() => {
    const palette = this.palette();
    const activeShade = this.activeShade();
    const excludedColors = this.excludedColors();
    const dark = this.theme() === THEME.DARK;
    const activeName = this.colorObj()?.colorName;

    return Object.entries(palette).map(([key, value], index) => {
      const color =
        (Array.isArray(value) ? value[activeShade] : value) || "transparent";
      const keybinding = colorPickerHotkeyBindings[index];
      const displayColor = applyDarkModeFilter(color, dark);
      const label = t(
        `colors.${key.replace(/\d+/, "")}` as unknown as TranslationKeys,
        null,
        "",
      );

      return {
        key,
        excluded: !!excludedColors?.includes(color),
        color,
        displayColor,
        keybinding,
        className: clsx("color-picker__button color-picker__button--large", {
          "has-outline": !isColorDark(color, 255),
          active: activeName === key,
          "is-transparent": color === "transparent" || !color,
        }),
        title: `${label}${
          color.startsWith("#") ? ` ${color}` : ""
        } — ${keybinding}`,
        ariaLabel: `${label} — ${keybinding}`,
      };
    });
  });

  /** upstream focuses the active base color whenever it (or the active
   * section) changes, so arrow-key navigation moves the focus ring along */
  private readonly focusActive = effect(() => {
    const activeName = this.colorObj()?.colorName;
    // read so the effect reruns as the grid rerenders
    this.entries();
    if (this.section.active() !== "baseColors" || !activeName) {
      return;
    }
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="color-${activeName}"]`)
      ?.focus();
  });

  protected select(color: string) {
    this.colorChange.emit(color);
    this.section.set("baseColors");
  }

  protected startSwatchDrag(event: PointerEvent, color: string) {
    this.dnd.startSwatchDrag(event, color);
  }
}
