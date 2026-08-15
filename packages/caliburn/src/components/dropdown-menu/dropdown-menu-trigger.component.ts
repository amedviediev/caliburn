import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";

import clsx from "clsx";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuTrigger.tsx`. `mobile`
 * replaces `useEditorInterface().formFactor === "phone"` as a plain input —
 * the consumer (which already has editor access) passes it down, keeping
 * this primitive host-agnostic and directly unit-testable.
 */
@Component({
  selector: "caliburn-dropdown-menu-trigger",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="hostClass()"
      data-testid="dropdown-menu-button"
      [attr.title]="title() ?? null"
      (click)="toggle.emit()"
    >
      <ng-content />
    </button>
  `,
})
export class CaliburnDropdownMenuTriggerComponent {
  readonly mobile = input(false);
  readonly title = input<string>();
  readonly extraClass = input<string>("", { alias: "class" });

  readonly toggle = output<void>();

  readonly hostClass = computed(() =>
    clsx("dropdown-menu-button", this.extraClass(), "zen-mode-transition", {
      "dropdown-menu-button--mobile": this.mobile(),
    }),
  );
}
