import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { CaliburnWelcomeScreenMenuItemContentComponent } from "./menu-item-content.component";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `WelcomeScreenMenuItemLink` — the anchor sibling of
 * `WelcomeScreenMenuItem`. Attribute-selector component
 * (`a[caliburn-welcome-screen-menu-item-link]`) — no wrapper element — same
 * reasoning as the button variant.
 */
@Component({
  selector: "a[caliburn-welcome-screen-menu-item-link]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnWelcomeScreenMenuItemContentComponent],
  host: {
    target: "_blank",
    rel: "noopener",
    "[attr.href]": "href()",
    "[class]": "'welcome-screen-menu-item ' + extraClass()",
    "[attr.aria-label]": "ariaLabel() ?? null",
    "[attr.data-testid]": "testId() ?? null",
  },
  templateUrl: "./menu-item-link.component.html",
})
export class CaliburnWelcomeScreenMenuItemLinkComponent {
  readonly href = input.required<string>();
  readonly icon = input<string>();
  readonly shortcut = input<string | null>();
  readonly mobile = input(false);
  readonly ariaLabel = input<string>();
  readonly testId = input<string>();
  readonly extraClass = input<string>("", { alias: "class" });
}
