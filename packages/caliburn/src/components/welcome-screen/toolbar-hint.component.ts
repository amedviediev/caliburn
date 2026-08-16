import { ChangeDetectionStrategy, Component } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import { translated } from "../../i18n";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Hints.tsx`'s
 * `ToolbarHint`. Host-bound (no wrapper element), same rationale as
 * `MenuHint`.
 */
@Component({
  selector: "caliburn-welcome-screen-toolbar-hint",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      "excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--toolbar",
  },
  imports: [NgIcon],
  templateUrl: "./toolbar-hint.component.html",
})
export class CaliburnWelcomeScreenToolbarHintComponent {
  protected readonly label = translated(() =>
    t("welcomeScreen.defaults.toolbarHint"),
  );
}
