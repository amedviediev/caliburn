import { ChangeDetectionStrategy, Component } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import { translated } from "../../i18n";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Hints.tsx`'s
 * `HelpHint`. Host-bound (no wrapper element), same rationale as `MenuHint`.
 */
@Component({
  selector: "caliburn-welcome-screen-help-hint",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      "excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--help",
  },
  imports: [NgIcon],
  templateUrl: "./help-hint.component.html",
})
export class CaliburnWelcomeScreenHelpHintComponent {
  protected readonly label = translated(() =>
    t("welcomeScreen.defaults.helpHint"),
  );
}
