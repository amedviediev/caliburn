import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

import { isColorDark } from "@excalidraw/common";

/**
 * Angular port of upstream `ColorPicker/HotkeyLabel.tsx`. Attribute-selector
 * component so the host IS upstream's `div.color-picker__button__hotkey-label`
 * — it is absolutely positioned against the swatch button, which leaves no
 * room for a wrapper element.
 */
@Component({
  selector: "div[caliburn-hotkey-label]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "color-picker__button__hotkey-label",
    "[style.color]": "textColor()",
  },
  templateUrl: "./hotkey-label.component.html",
})
export class CaliburnHotkeyLabelComponent {
  readonly color = input.required<string>();
  readonly keyLabel = input.required<string | number>();
  readonly isShade = input(false);

  protected readonly textColor = computed(() =>
    isColorDark(this.color()) ? "#fff" : "#000",
  );

  protected readonly text = computed(
    () => `${this.isShade() ? "⇧" : ""}${this.keyLabel()}`,
  );
}
