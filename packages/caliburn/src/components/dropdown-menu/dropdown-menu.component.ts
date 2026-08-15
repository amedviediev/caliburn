import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { CLASSES } from "@excalidraw/common";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenu.tsx`. Upstream builds
 * on Radix's `DropdownMenu.Root` for open-state context; here `open` is
 * simply an `@Input` read by `caliburn-dropdown-menu-content` via DI (see
 * `dropdown-menu-content.component.ts`) — the same controlled-`open`
 * contract upstream already has (the consumer owns the boolean, e.g.
 * `Toolbar.tsx`'s `isExtraToolsMenuOpen`). Host-bound (no wrapper element)
 * so the rendered DOM is exactly `.dropdown-menu-event-wrapper`.
 */
@Component({
  selector: "caliburn-dropdown-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: CLASSES.DROPDOWN_MENU_EVENT_WRAPPER,
    style: "display: contents;",
  },
  template: `<ng-content />`,
})
export class CaliburnDropdownMenuComponent {
  readonly open = input.required<boolean>();
}
