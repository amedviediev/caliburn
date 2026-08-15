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
 *
 * Attribute-selector component (`button[caliburn-button]`): the host IS the
 * real `<button>` — no wrapper tag.
 *
 * `testId`/`ariaLabel` are explicit inputs standing in for upstream's
 * `{...rest}` HTML-attribute spread — `Sidebar/SidebarHeader.tsx` passes
 * `data-testid="sidebar-dock"`/`"sidebar-close"` and `aria-label`, which
 * upstream's own Sidebar tests query by.
 */
@Component({
  selector: "button[caliburn-button]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[attr.type]": "type()",
    "[class]": "hostClass()",
    "[disabled]": "disabled()",
    "[attr.data-testid]": "testId() ?? null",
    "[attr.aria-label]": "ariaLabel() ?? null",
    "(click)": "select.emit()",
  },
  template: `<ng-content />`,
})
export class CaliburnButtonComponent {
  readonly type = input<"button" | "submit" | "reset">("button");
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly testId = input<string>();
  readonly ariaLabel = input<string>();

  readonly select = output<void>();

  readonly hostClass = computed(() =>
    clsx("excalidraw-button", { selected: this.selected() }),
  );
}
