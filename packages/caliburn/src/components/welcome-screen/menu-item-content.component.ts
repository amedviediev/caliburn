import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { NgIcon } from "@ng-icons/core";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * co-located `WelcomeScreenMenuItemContent`. `mobile` replaces
 * `useEditorInterface().formFactor !== "phone"` as a plain input, same
 * host-agnostic rationale as `dropdown-menu-item-content.component.ts`'s
 * `mobile` input — keeps this a pure UI primitive with no editor dependency
 * (the concrete menu items that do have one, e.g. `menu-item-help.component.ts`,
 * compute it and pass it down).
 *
 * Host-bound with `display: contents` — upstream renders this as a React
 * fragment so its icon/text/shortcut children lay out as direct children of
 * `.welcome-screen-menu-item` (`display: grid`); `display: contents` keeps
 * this wrapper transparent to that layout the same way.
 */
@Component({
  selector: "caliburn-welcome-screen-menu-item-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: "display: contents;",
  },
  imports: [NgIcon],
  templateUrl: "./menu-item-content.component.html",
})
export class CaliburnWelcomeScreenMenuItemContentComponent {
  readonly icon = input<string>();
  readonly shortcut = input<string | null>();
  readonly mobile = input(false);

  protected showShortcut() {
    return !!this.shortcut() && !this.mobile();
  }
}
