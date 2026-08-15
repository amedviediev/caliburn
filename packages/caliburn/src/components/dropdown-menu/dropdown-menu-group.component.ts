import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

import clsx from "clsx";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuGroup.tsx`. Host-bound
 * (no wrapper element) so the rendered DOM is exactly `.dropdown-menu-group`.
 */
@Component({
  selector: "caliburn-dropdown-menu-group",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "hostClass()",
  },
  templateUrl: "./dropdown-menu-group.component.html",
})
export class CaliburnDropdownMenuGroupComponent {
  readonly title = input<string>();
  readonly extraClass = input<string>("", { alias: "class" });

  readonly hostClass = computed(() =>
    clsx("dropdown-menu-group", this.extraClass()),
  );
}
