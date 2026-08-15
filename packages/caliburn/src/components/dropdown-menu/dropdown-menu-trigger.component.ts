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
 *
 * Attribute-selector component (`button[caliburn-dropdown-menu-trigger]`):
 * the host IS the real `<button>` — no wrapper tag — so upstream's
 * `.dropdown-menu-button` element is the actual direct child of whatever
 * DOM position the consumer places it at (relevant for any future `>`-keyed
 * selector targeting it, and needed for `dropdown-menu.component.ts`'s
 * `contentChild(..., { read: ElementRef })` to resolve the real button for
 * positioning the content).
 */
@Component({
  selector: "button[caliburn-dropdown-menu-trigger]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: "button",
    "[class]": "hostClass()",
    "[attr.data-testid]": "testId()",
    "[attr.title]": "title() ?? null",
    "(click)": "toggle.emit()",
  },
  templateUrl: "./dropdown-menu-trigger.component.html",
})
export class CaliburnDropdownMenuTriggerComponent {
  readonly mobile = input(false);
  readonly title = input<string>();
  /** upstream spreads `...rest` after its own `data-testid`, so a consumer
   * (e.g. `MainMenu.tsx`) can override it — hence the input */
  readonly testId = input("dropdown-menu-button");

  readonly toggle = output<void>();

  readonly hostClass = computed(() =>
    clsx("dropdown-menu-button", "zen-mode-transition", {
      "dropdown-menu-button--mobile": this.mobile(),
    }),
  );
}
