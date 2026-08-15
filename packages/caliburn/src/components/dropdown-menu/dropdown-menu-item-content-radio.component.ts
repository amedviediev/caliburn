import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

import { CaliburnRadioGroupComponent } from "../radio-group.component";

import type { RadioGroupChoice } from "../radio-group.component";

/**
 * Angular port of upstream
 * `dropdownMenu/DropdownMenuItemContentRadio.tsx` — a menu row whose control
 * is a `RadioGroup` rather than a click target (the theme picker).
 *
 * `mobile` replaces `useEditorInterface().formFactor !== "phone"`, as the
 * other dropdown-menu primitives do. Host-bound with `display: contents`
 * (see `styles.scss`): upstream renders a fragment of the row plus an
 * optional orphaned shortcut, both direct children of
 * `.dropdown-menu-container`.
 */
@Component({
  selector: "caliburn-dropdown-menu-item-content-radio",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnRadioGroupComponent],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./dropdown-menu-item-content-radio.component.html",
})
export class CaliburnDropdownMenuItemContentRadioComponent<T> {
  readonly name = input.required<string>();
  readonly value = input.required<T>();
  readonly choices = input.required<RadioGroupChoice<T>[]>();
  readonly shortcut = input<string>();
  readonly mobile = input(false);

  readonly valueChange = output<T>();
}
