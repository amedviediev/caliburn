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

import { NgIcon } from "@ng-icons/core";

import { KEYS, normalizeInputColor } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import type { ColorPickerType } from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { translated } from "../../i18n";

import { CaliburnColorPickerSection } from "./color-picker-section";

import type { CaliburnEditorComponent } from "../../editor.component";

import type { ElementRef } from "@angular/core";

/**
 * Angular port of upstream `ColorPicker/ColorInput.tsx` — the hex/CSS color
 * text field with its inline validation message.
 *
 * The eye-dropper trigger sits at the field's right edge, as upstream's
 * does, and toggles the editor's `activeEyeDropper` (upstream's
 * `activeEyeDropperAtom`).
 *
 * The field listens on `change` as well as `input` (as
 * `frame-name.component` does): React routes both through one `onChange`,
 * Angular does not, and both carry the committed value.
 */
@Component({
  selector: "caliburn-color-input",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  templateUrl: "./color-input.component.html",
})
export class CaliburnColorInputComponent {
  private readonly section = inject(CaliburnColorPickerSection);
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly color = input.required<string>();
  readonly label = input.required<string>();
  readonly colorPickerType = input.required<ColorPickerType>();
  readonly placeholder = input<string | undefined>(undefined);

  readonly colorChange = output<string>();

  private readonly inputRef =
    viewChild.required<ElementRef<HTMLInputElement>>("colorInput");

  private readonly eyeDropperTriggerRef =
    viewChild<ElementRef<HTMLDivElement>>("eyeDropperTrigger");

  protected readonly showEyeDropper =
    this.editor.editorInterface.formFactor !== "phone";

  protected readonly eyeDropperTitle = translated(
    () =>
      `${t(
        "labels.eyeDropper",
      )} — ${KEYS.I.toLocaleUpperCase()} or ${getShortcutKey("Alt")} `,
  );

  protected isEyeDropperActive() {
    return !!this.editor.activeEyeDropper();
  }

  protected toggleEyeDropper() {
    const editor = this.editor;
    editor.batchCommits(() => {
      editor.activeEyeDropper.set(
        editor.activeEyeDropper()
          ? null
          : {
              keepOpenOnAlt: false,
              onSelect: (color) => this.colorChange.emit(color),
              colorPickerType: this.colorPickerType(),
            },
      );
      editor.setState({});
    });
  }

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
    } else if (event.key === KEYS.ESCAPE) {
      this.eyeDropperTriggerRef()?.nativeElement.focus();
    }
    event.stopPropagation();
  }
}
