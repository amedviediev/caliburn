import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";

import clsx from "clsx";

/**
 * Angular port of upstream `Switch.tsx`. Host-bound (no wrapper element) so
 * the rendered DOM root is exactly `.Switch`.
 */
@Component({
  selector: "caliburn-switch",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "hostClass()",
  },
  template: `
    <input
      [name]="name()"
      [id]="name()"
      [attr.title]="title() ?? null"
      type="checkbox"
      [checked]="checked()"
      [disabled]="disabled()"
      (change)="valueChange.emit(!checked())"
      (keydown)="onKeydown($event)"
    />
  `,
})
export class CaliburnSwitchComponent {
  readonly name = input.required<string>();
  readonly checked = input.required<boolean>();
  readonly title = input<string>();
  readonly disabled = input(false);

  readonly valueChange = output<boolean>();

  readonly hostClass = computed(() =>
    clsx("Switch", {
      toggled: this.checked(),
      disabled: this.disabled(),
    }),
  );

  onKeydown(event: KeyboardEvent) {
    if (event.key === " ") {
      this.valueChange.emit(!this.checked());
    }
  }
}
