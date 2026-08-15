import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";

import clsx from "clsx";

import { CaliburnSpinnerComponent } from "./spinner.component";

export type DialogActionType = "primary" | "danger";

/**
 * Angular port of upstream `DialogActionButton.tsx`.
 *
 * Attribute-selector component (`button[caliburn-dialog-action-button]`): the
 * host IS the real `<button>` — no wrapper tag — so `.confirm-dialog-buttons`'
 * flex layout applies to the buttons themselves.
 *
 * Upstream renders the children wrapper only when there are children; a
 * projected slot can't be probed that cheaply in Angular, so the wrapper is
 * `display: contents` instead — it generates no box when nothing is
 * projected, and lets a projected icon be the button's own flex item.
 */
@Component({
  selector: "button[caliburn-dialog-action-button]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnSpinnerComponent],
  host: {
    type: "button",
    "[class]": "hostClass()",
    "[attr.aria-label]": "label()",
    "[attr.data-testid]": "testId() ?? null",
    "(click)": "select.emit($event)",
  },
  templateUrl: "./dialog-action-button.component.html",
})
export class CaliburnDialogActionButtonComponent {
  readonly label = input.required<string>();
  readonly actionType = input<DialogActionType>();
  readonly isLoading = input(false);
  readonly testId = input<string>();
  readonly extraClass = input<string>("", { alias: "class" });

  readonly select = output<MouseEvent>();

  readonly hostClass = computed(() =>
    clsx(
      "Dialog__action-button",
      this.actionType() ? `Dialog__action-button--${this.actionType()}` : "",
      this.extraClass(),
    ),
  );
}
