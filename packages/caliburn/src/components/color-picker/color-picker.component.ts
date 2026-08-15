import { NgTemplateOutlet } from "@angular/common";

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import clsx from "clsx";

import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  COLOR_PALETTE,
  THEME,
  applyDarkModeFilter,
  isColorDark,
} from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import type { ColorPaletteCustom } from "@excalidraw/common";
import type { AppState } from "@excalidraw/excalidraw/types";
import type { ColorPickerType } from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnButtonSeparatorComponent } from "../button-separator.component";

import { CaliburnColorPickerSection } from "./color-picker-section";
import { CaliburnColorInputComponent } from "./color-input.component";
import { CaliburnPickerComponent } from "./picker.component";
import { CaliburnPickerHeadingComponent } from "./picker-heading.component";
import { CaliburnPropertiesPopoverComponent } from "./properties-popover.component";
import { CaliburnTopPicksComponent } from "./top-picks.component";

import type { ElementRef } from "@angular/core";

import type { CaliburnEditorComponent } from "../../editor.component";

const isColorPickerPopup = (
  popup: AppState["openPopup"],
): popup is ColorPickerType =>
  popup === "elementStroke" ||
  popup === "elementBackground" ||
  popup === "canvasBackground";

/**
 * Angular port of upstream `ColorPicker/ColorPicker.tsx` — the top-picks
 * strip, the active-color trigger and the popup it opens.
 *
 * Caliburn's styles panel is always upstream's `stylesPanelMode: "full"`
 * (see `AppViewport`'s `getStylesPanelMode`), so the compact/mobile branches
 * (`compact-sizing`, `mobile-border`, the stroke overlay icon, the in-popup
 * title, hidden hotkey labels) have no reachable call site and are not
 * ported. Neither is the top-picks drag & drop customization
 * (`customizableTopPicks` / `topPicksDnD.tsx`) — see `top-picks.component.ts`.
 */
@Component({
  selector: "caliburn-color-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CaliburnColorPickerSection],
  imports: [
    CaliburnButtonSeparatorComponent,
    CaliburnColorInputComponent,
    CaliburnPickerComponent,
    CaliburnPickerHeadingComponent,
    CaliburnPropertiesPopoverComponent,
    CaliburnTopPicksComponent,
    NgIcon,
    NgTemplateOutlet,
  ],
  templateUrl: "./color-picker.component.html",
})
export class CaliburnColorPickerComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );
  private readonly section = inject(CaliburnColorPickerSection);

  readonly type = input.required<ColorPickerType>();
  readonly color = input.required<string | null>();
  readonly label = input.required<string>();
  readonly palette = input<ColorPaletteCustom | null>(COLOR_PALETTE);
  readonly topPicks = input<readonly string[] | undefined>(undefined);
  readonly excludedColors = input<readonly string[] | undefined>(undefined);
  /** upstream's `updateData` — the action's own dispatcher, used both for the
   * color change and for driving `appState.openPopup` */
  readonly updateData = input.required<(formData?: any) => void>();

  readonly colorChange = output<string>();

  private readonly triggerRef =
    viewChild.required<ElementRef<HTMLButtonElement>>("trigger");

  protected readonly hexCodeLabel = t("colorPicker.hexCode");
  protected readonly colorPlaceholder = t("colorPicker.color");

  protected readonly theme = computed(() => {
    this.editor.changeGeneration();
    return this.editor.state.theme;
  });

  protected readonly openPopup = computed(() => {
    this.editor.changeGeneration();
    return this.editor.state.openPopup;
  });

  protected readonly elements = computed(() => {
    this.editor.changeGeneration();
    return this.editor.scene.getElementsIncludingDeleted();
  });

  protected readonly isOpen = computed(() => this.openPopup() === this.type());

  protected readonly triggerRect = signal<DOMRect | null>(null);

  protected readonly displayColor = computed(() => {
    const color = this.color();
    return color
      ? applyDarkModeFilter(color, this.theme() === THEME.DARK)
      : null;
  });

  protected readonly triggerClass = computed(() => {
    const color = this.color();
    return clsx("color-picker__button active-color properties-trigger", {
      "is-transparent": !color || color === "transparent",
      "has-outline":
        !color || !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD),
    });
  });

  protected readonly triggerTitle = computed(() =>
    this.type() === "elementStroke"
      ? t("labels.showStroke")
      : t("labels.showBackground"),
  );

  private readonly measureTriggerOnOpen = effect(() => {
    if (!this.isOpen()) {
      // upstream clears the active section when the popup closes
      this.section.active.set(null);
      return;
    }
    this.triggerRect.set(
      this.triggerRef().nativeElement.getBoundingClientRect(),
    );
  });

  protected onTriggerClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.updateData()({ openPopup: this.isOpen() ? null : this.type() });
  }

  protected onTopPickChange(color: string) {
    this.colorChange.emit(color);
    const openPopup = this.openPopup();
    // if another color-picker popup is open, follow the user's focus over to
    // this picker (same as clicking its trigger)
    if (isColorPickerPopup(openPopup) && openPopup !== this.type()) {
      // deferred: each updateData spreads the full pre-commit appState, so
      // issuing this in the same task would clobber the color change
      // committed above
      setTimeout(() => this.updateData()({ openPopup: this.type() }), 0);
    }
  }

  protected onClose() {
    if (this.isOpen()) {
      this.updateData()({ openPopup: null });
    }
  }
}
