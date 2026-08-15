import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

export interface RadioGroupChoice<T> {
  value: T;
  label: string;
  ariaLabel?: string;
}

/**
 * Angular port of upstream `RadioGroup.tsx`. `choice.label` is narrowed from
 * upstream's `React.ReactNode` to `string` — its one current consumer
 * (`ImageExportDialog.tsx`, Task 19) only ever passes text.
 */
@Component({
  selector: "caliburn-radio-group",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "RadioGroup",
  },
  templateUrl: "./radio-group.component.html",
})
export class CaliburnRadioGroupComponent<T> {
  readonly choices = input.required<RadioGroupChoice<T>[]>();
  readonly value = input.required<T>();
  readonly name = input.required<string>();

  readonly valueChange = output<T>();
}
