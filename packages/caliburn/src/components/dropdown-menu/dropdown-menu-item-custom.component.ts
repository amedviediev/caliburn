import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

import clsx from "clsx";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuItemCustom.tsx`.
 * Host-bound (no wrapper element) so the rendered DOM is exactly
 * `.dropdown-menu-item-base.dropdown-menu-item-custom`.
 */
@Component({
  selector: "caliburn-dropdown-menu-item-custom",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "hostClass()",
  },
  template: `<ng-content />`,
})
export class CaliburnDropdownMenuItemCustomComponent {
  readonly selected = input(false);
  readonly extraClass = input<string>("", { alias: "class" });

  readonly hostClass = computed(() =>
    clsx(
      "dropdown-menu-item-base",
      "dropdown-menu-item-custom",
      this.extraClass(),
      {
        "dropdown-menu-item--selected": this.selected(),
      },
    ),
  );
}
