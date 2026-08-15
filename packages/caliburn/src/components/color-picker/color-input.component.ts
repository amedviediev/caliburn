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

import { KEYS, normalizeInputColor } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { CaliburnColorPickerSection } from "./color-picker-section";

import type { ElementRef } from "@angular/core";

/**
 * Angular port of upstream `ColorPicker/ColorInput.tsx` — the hex/CSS color
 * text field with its inline validation message.
 *
 * Upstream also renders the eye-dropper trigger here (and in
 * `Picker.tsx`'s `I`/`Alt` key handling); caliburn has no eye-dropper yet
 * (upstream `components/EyeDropper.tsx` + its `activeEyeDropperAtom` and the
 * App-level overlay it needs are unported), so the trigger is omitted rather
 * than rendered dead.
 *
 * The field listens on `change` as well as `input` (as
 * `frame-name.component` does): React routes both through one `onChange`,
 * Angular does not, and both carry the committed value.
 */
@Component({
  selector: "caliburn-color-input",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./color-input.component.html",
})
export class CaliburnColorInputComponent {
  private readonly section = inject(CaliburnColorPickerSection);

  readonly color = input.required<string>();
  readonly label = input.required<string>();
  readonly placeholder = input<string | undefined>(undefined);

  readonly colorChange = output<string>();

  private readonly inputRef =
    viewChild.required<ElementRef<HTMLInputElement>>("colorInput");

  protected readonly innerValue = signal("");
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly displayValue = computed(() =>
    (this.innerValue() || "").replace(/^#/, ""),
  );

  private readonly syncFromColor = effect(() => {
    this.innerValue.set(this.color());
  });

  /** upstream refocuses the field whenever the picker's active section
   * changes back to the hex input */
  private readonly focusOnSection = effect(() => {
    if (this.section.active() === "hex") {
      this.inputRef().nativeElement.focus();
    }
  });

  protected onInput(event: Event) {
    this.changeColor((event.target as HTMLInputElement).value);
  }

  private changeColor(inputValue: string) {
    const value = inputValue.toLowerCase().trim();
    const color = normalizeInputColor(value);

    if (color) {
      this.colorChange.emit(color);
      this.errorMessage.set(null);
    } else if (value.length === 0) {
      this.errorMessage.set(null);
    } else if (/^#?[0-9a-f]+$/.test(value)) {
      this.errorMessage.set(t("colorPicker.invalidHexLength"));
    } else {
      this.errorMessage.set(t("colorPicker.invalidColor"));
    }
    this.innerValue.set(value);
  }

  protected onBlur() {
    this.innerValue.set(this.color());
    this.errorMessage.set(null);
  }

  protected onFocus() {
    this.section.set("hex");
  }

  protected onKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.TAB) {
      return;
    }
    event.stopPropagation();
  }
}
