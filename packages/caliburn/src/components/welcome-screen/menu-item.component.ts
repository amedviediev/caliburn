import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

import { CaliburnWelcomeScreenMenuItemContentComponent } from "./menu-item-content.component";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `WelcomeScreenMenuItem`. Attribute-selector component
 * (`button[caliburn-welcome-screen-menu-item]`) — no wrapper element — so
 * `.welcome-screen-menu-item` is a direct child of the enclosing
 * `caliburn-welcome-screen-menu` (a `display: flex; gap: 2px` column).
 */
@Component({
  selector: "button[caliburn-welcome-screen-menu-item]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnWelcomeScreenMenuItemContentComponent],
  host: {
    type: "button",
    "[class]": "'welcome-screen-menu-item ' + extraClass()",
    "[attr.aria-label]": "ariaLabel() ?? null",
    "[attr.data-testid]": "testId() ?? null",
    "(click)": "select.emit()",
  },
  templateUrl: "./menu-item.component.html",
})
export class CaliburnWelcomeScreenMenuItemComponent {
  readonly icon = input<string>();
  readonly shortcut = input<string | null>();
  readonly mobile = input(false);
  readonly ariaLabel = input<string>();
  readonly testId = input<string>();
  readonly extraClass = input<string>("", { alias: "class" });

  readonly select = output<void>();
}
