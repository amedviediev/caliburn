import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { NgIcon } from "@ng-icons/core";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuItemContent.tsx`.
 * `mobile` replaces `useEditorInterface().formFactor !== "phone"`, see
 * `dropdown-menu-trigger.component.ts`. `Ellipsify` (a two-line upstream
 * helper, not itself in the primitives brief) is inlined as its exact
 * `text-overflow/overflow/white-space` style rather than ported as its own
 * component.
 */
@Component({
  selector: "caliburn-dropdown-menu-item-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  template: `
    @if (icon()) {
      <div class="dropdown-menu-item__icon">
        <ng-icon [name]="icon()!" />
      </div>
    }
    <div
      class="dropdown-menu-item__text"
      style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap"
    >
      <ng-content />
    </div>
    @if (hasBadge()) {
      <div class="dropdown-menu-item__badge">
        <ng-content select="[dropdown-menu-item-badge-slot]" />
      </div>
    }
    @if (shortcut() && !mobile()) {
      <div class="dropdown-menu-item__shortcut">{{ shortcut() }}</div>
    }
  `,
})
export class CaliburnDropdownMenuItemContentComponent {
  readonly icon = input<string>();
  readonly shortcut = input<string>();
  readonly hasBadge = input(false);
  readonly mobile = input(false);
}
