import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";

import clsx from "clsx";

/**
 * Angular port of upstream `Button.tsx` (`.excalidraw-button`).
 */
@Component({
  selector: "caliburn-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [class]="hostClass()"
      [disabled]="disabled()"
      (click)="select.emit()"
    >
      <ng-content />
    </button>
  `,
})
export class CaliburnButtonComponent {
  readonly type = input<"button" | "submit" | "reset">("button");
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly extraClass = input<string>("", { alias: "class" });

  readonly select = output<void>();

  readonly hostClass = computed(() =>
    clsx("excalidraw-button", this.extraClass(), { selected: this.selected() }),
  );
}
