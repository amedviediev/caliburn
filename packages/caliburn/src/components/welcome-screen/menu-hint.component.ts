import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Hints.tsx`'s
 * `MenuHint`. Host-bound (no wrapper element) — LayerUI renders it at the
 * position upstream's tunnel outlet sits at. `label` is upstream's
 * `children`, with the same default.
 */
@Component({
  selector: "caliburn-welcome-screen-menu-hint",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      "excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--menu",
  },
  imports: [NgIcon],
  templateUrl: "./menu-hint.component.html",
})
export class CaliburnWelcomeScreenMenuHintComponent {
  readonly label = input(t("welcomeScreen.defaults.menuHint"));
}
