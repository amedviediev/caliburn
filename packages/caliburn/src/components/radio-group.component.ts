import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

import { NgIcon } from "@ng-icons/core";

export interface RadioGroupChoice<T> {
  value: T;
  /** the choice's text label; supply this or `icon` */
  label?: string;
  /** an ng-icon name, for the icon-labelled choices (the theme picker) */
  icon?: string;
  ariaLabel?: string;
}

/**
 * Angular port of upstream `RadioGroup.tsx`. `choice.label` is narrowed from
 * upstream's `React.ReactNode` to a text label or an icon name — the two
 * shapes its consumers use (`ImageExportDialog.tsx`'s scales,
 * `DefaultItems.tsx`'s theme picker).
 */
@Component({
  selector: "caliburn-radio-group",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "RadioGroup",
  },
  imports: [NgIcon],
  templateUrl: "./radio-group.component.html",
})
export class CaliburnRadioGroupComponent<T> {
  readonly choices = input.required<RadioGroupChoice<T>[]>();
  readonly value = input.required<T>();
  readonly name = input.required<string>();

  readonly valueChange = output<T>();
}
