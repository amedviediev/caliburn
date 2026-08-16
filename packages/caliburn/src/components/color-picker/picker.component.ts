import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import {
  DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
  EVENT,
  KEYS,
} from "@excalidraw/common";

import {
  getColorNameAndShadeFromColor,
  getMostUsedCustomColors,
  isCustomColor,
} from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";
import { colorPickerKeyNavHandler } from "@excalidraw/excalidraw/components/ColorPicker/keyboardNavHandlers";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ColorPaletteCustom } from "@excalidraw/common";
import type { ExcalidrawElement, Theme } from "@excalidraw/element/types";
import type { ColorPickerType } from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";

import { translated } from "../../i18n";

import { CaliburnColorPickerSection } from "./color-picker-section";
import { CaliburnCustomColorListComponent } from "./custom-color-list.component";
import { CaliburnPickerColorListComponent } from "./picker-color-list.component";
import { CaliburnPickerHeadingComponent } from "./picker-heading.component";
import { CaliburnShadeListComponent } from "./shade-list.component";

import type React from "react";
import type { OnDestroy, OnInit, ElementRef } from "@angular/core";

/**
 * Angular port of upstream `ColorPicker/Picker.tsx` — the popup body: the
 * most-used custom colors, the palette grid, the shade row, and whatever the
 * caller projects after them (the hex input). Attribute-selector component:
 * the host IS upstream's outer `role="dialog"` element.
 *
 * The eye-dropper toggles upstream's keyboard handler exposes (`I`, `Alt`,
 * and the `Alt` keyup that closes it again) are forwarded to the parent
 * `caliburn-color-picker`, which owns the editor's `activeEyeDropper` — as
 * upstream's `Picker` forwards them to `ColorPicker.tsx`.
 */
@Component({
  selector: "div[caliburn-picker]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "dialog",
    "aria-modal": "true",
    "[attr.aria-label]": "colorPickerLabel",
  },
  imports: [
    CaliburnCustomColorListComponent,
    CaliburnPickerColorListComponent,
    CaliburnPickerHeadingComponent,
    CaliburnShadeListComponent,
  ],
  templateUrl: "./picker.component.html",
})
export class CaliburnPickerComponent implements OnInit, OnDestroy {
  private readonly section = inject(CaliburnColorPickerSection);

  readonly theme = input.required<Theme>();
  readonly color = input.required<string | null>();
  readonly type = input.required<ColorPickerType>();
  readonly elements = input.required<readonly ExcalidrawElement[]>();
  readonly palette = input.required<ColorPaletteCustom>();
  readonly updateData = input.required<(formData?: any) => void>();
  readonly showTitle = input(false);
  readonly showHotKey = input(true);
  readonly excludedColors = input<readonly string[] | undefined>(undefined);

  readonly colorChange = output<string>();
  readonly escape = output<KeyboardEvent>();
  readonly eyeDropperToggle = output<boolean | undefined>();

  private readonly contentRef =
    viewChild.required<ElementRef<HTMLDivElement>>("pickerContent");

  protected readonly colorPickerLabel = translated(() =>
    t("labels.colorPicker"),
  );
  protected readonly headings = translated(() => ({
    mostUsedCustomColors: t("colorPicker.mostUsedCustomColors"),
    colors: t("colorPicker.colors"),
    shades: t("colorPicker.shades"),
  }));

  protected readonly customColors = signal<string[]>([]);
  protected readonly activeShade = signal(0);

  protected readonly title = computed(() => {
    if (!this.showTitle()) {
      return null;
    }
    const type = this.type();
    return type === "elementStroke"
      ? t("labels.stroke")
      : type === "elementBackground"
      ? t("labels.background")
      : null;
  });

  private readonly colorObj = computed(() =>
    getColorNameAndShadeFromColor({
      color: this.color(),
      palette: this.palette(),
    }),
  );

  ngOnInit() {
    document.addEventListener(EVENT.KEYUP, this.onKeyUp, { capture: true });

    const type = this.type();
    this.customColors.set(
      type === "canvasBackground"
        ? []
        : getMostUsedCustomColors(this.elements(), type, this.palette()),
    );
    this.activeShade.set(
      this.colorObj()?.shade ??
        (type === "elementBackground"
          ? DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX
          : DEFAULT_ELEMENT_STROKE_COLOR_INDEX),
    );
  }

  private readonly seedActiveSection = effect(() => {
    if (this.section.active()) {
      return;
    }
    const color = this.color();
    const palette = this.palette();
    const isCustom = !!color && isCustomColor({ color, palette });
    const isCustomButNotInList =
      isCustom && !this.customColors().includes(color);

    this.section.set(
      isCustomButNotInList
        ? null
        : isCustom
        ? "custom"
        : this.colorObj()?.shade != null
        ? "shades"
        : "baseColors",
    );
  });

  private readonly trackActiveShade = effect(() => {
    const shade = this.colorObj()?.shade;
    if (shade != null) {
      this.activeShade.set(shade);
    }
  });

  private readonly focusOnMount = effect(() => {
    this.contentRef().nativeElement.focus();
  });

  ngOnDestroy() {
    document.removeEventListener(EVENT.KEYUP, this.onKeyUp, { capture: true });
  }

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (event.key === KEYS.ALT) {
      this.eyeDropperToggle.emit(false);
    }
  };

  protected onKeyDown(event: KeyboardEvent) {
    const handled = colorPickerKeyNavHandler({
      event: event as unknown as React.KeyboardEvent,
      activeColorPickerSection: this.section.active(),
      palette: this.palette(),
      color: this.color(),
      onChange: (color) => this.colorChange.emit(color),
      onEyeDropperToggle: (force?: boolean) =>
        this.eyeDropperToggle.emit(force),
      customColors: this.customColors(),
      setActiveColorPickerSection: this.section.set,
      updateData: this.updateData(),
      activeShade: this.activeShade(),
      onEscape: () => this.escape.emit(event),
      excludedColors: this.excludedColors(),
    });

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
