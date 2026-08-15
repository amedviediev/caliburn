import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `Logo`. Host-bound (no wrapper element), keeping the upstream wrapper's
 * classes exactly (`welcome-screen-center__logo excalifont
 * welcome-screen-decor`).
 *
 * Trademark rule: upstream's default child is `<ExcalidrawLogo withText />`
 * (the Excalidraw brand mark) — Excalidraw's brand assets must not ship as
 * Caliburn's own branding, so this renders the plain-text "Caliburn"
 * wordmark in that slot instead, keeping the wrapper's DOM/classes.
 */
@Component({
  selector: "caliburn-welcome-screen-logo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "welcome-screen-center__logo excalifont welcome-screen-decor",
  },
  templateUrl: "./logo.component.html",
})
export class CaliburnWelcomeScreenLogoComponent {}
