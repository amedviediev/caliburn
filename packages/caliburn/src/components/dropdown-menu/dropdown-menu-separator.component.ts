import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuSeparator.tsx`.
 * Host-bound (no wrapper element); takes no props upstream.
 */
@Component({
  selector: "caliburn-dropdown-menu-separator",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      "height: 1px; background-color: var(--default-border-color); margin: 6px 0; flex: 0 0 auto;",
  },
  template: ``,
})
export class CaliburnDropdownMenuSeparatorComponent {}
