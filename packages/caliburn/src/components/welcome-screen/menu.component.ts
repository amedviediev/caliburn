import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `Menu`. Host-bound (no wrapper element) so the rendered DOM is exactly
 * `.welcome-screen-menu` — a `display: flex; flex-direction: column; gap:
 * 2px` box whose projected menu items must be its direct children.
 */
@Component({
  selector: "caliburn-welcome-screen-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "welcome-screen-menu",
  },
  templateUrl: "./menu.component.html",
})
export class CaliburnWelcomeScreenMenuComponent {}
