import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  contentChild,
  input,
} from "@angular/core";

import { CLASSES } from "@excalidraw/common";

import { CaliburnDropdownMenuTriggerComponent } from "./dropdown-menu-trigger.component";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenu.tsx`. Upstream builds
 * on Radix's `DropdownMenu.Root` for open-state context; here `open` is
 * simply an `@Input` read by `caliburn-dropdown-menu-content` via DI (see
 * `dropdown-menu-content.component.ts`) — the same controlled-`open`
 * contract upstream already has (the consumer owns the boolean, e.g.
 * `Toolbar.tsx`'s `isExtraToolsMenuOpen`). Host-bound (no wrapper element)
 * so the rendered DOM is exactly `.dropdown-menu-event-wrapper`.
 *
 * Exposes the projected trigger's element (`trigger`) so
 * `caliburn-dropdown-menu-content` can position itself against it (Radix's
 * popper positioning has no CSS-only equivalent here since this wrapper is
 * `display: contents` — see `dropdown-menu-content.component.ts`).
 */
@Component({
  selector: "caliburn-dropdown-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: CLASSES.DROPDOWN_MENU_EVENT_WRAPPER,
    style: "display: contents;",
  },
  templateUrl: "./dropdown-menu.component.html",
})
export class CaliburnDropdownMenuComponent {
  readonly open = input.required<boolean>();

  readonly trigger = contentChild(CaliburnDropdownMenuTriggerComponent, {
    read: ElementRef,
  });
}
