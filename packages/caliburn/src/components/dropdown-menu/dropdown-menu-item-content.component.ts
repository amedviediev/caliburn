import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { NgIcon } from "@ng-icons/core";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuItemContent.tsx`.
 * `mobile` replaces `useEditorInterface().formFactor !== "phone"`, see
 * `dropdown-menu-trigger.component.ts`. `Ellipsify` (a two-line upstream
 * helper, not itself in the primitives brief) is inlined as its exact
 * `text-overflow/overflow/white-space` style rather than ported as its own
 * component.
 *
 * Upstream renders this as a React fragment (`<>...</>`) — no wrapping DOM
 * node — because `.dropdown-menu-item-base` is `display: flex; column-gap:
 * ...` (`DropdownMenu.scss`) and its icon/text/badge/shortcut children must
 * be its *direct* flex children for that gap/alignment to apply. Angular
 * components always have exactly one host element (and can't host on
 * `ng-container` — verified: Angular throws "ng-container tags cannot be
 * used as component hosts"), so this uses `display: contents` on the host
 * instead: the element still exists in the DOM (unlike a true fragment) but
 * is transparent to box generation, so its children lay out exactly as if
 * they were direct children of `.dropdown-menu-item`/`.dropdown-menu-item-base`
 * — the same technique upstream's own `DROPDOWN_MENU_EVENT_WRAPPER` div
 * uses ("remove this div from box layout", `DropdownMenu.tsx`).
 */
@Component({
  selector: "caliburn-dropdown-menu-item-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: "display: contents;",
  },
  imports: [NgIcon],
  templateUrl: "./dropdown-menu-item-content.component.html",
})
export class CaliburnDropdownMenuItemContentComponent {
  readonly icon = input<string>();
  readonly shortcut = input<string>();
  readonly hasBadge = input(false);
  readonly mobile = input(false);
}
