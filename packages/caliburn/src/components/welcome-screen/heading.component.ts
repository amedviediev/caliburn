import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `Heading`. Host-bound (no wrapper element) so the rendered DOM is exactly
 * `.welcome-screen-center__heading`, a direct flex child of
 * `.welcome-screen-center`.
 */
@Component({
  selector: "caliburn-welcome-screen-heading",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "welcome-screen-center__heading welcome-screen-decor excalifont",
  },
  templateUrl: "./heading.component.html",
})
export class CaliburnWelcomeScreenHeadingComponent {}
