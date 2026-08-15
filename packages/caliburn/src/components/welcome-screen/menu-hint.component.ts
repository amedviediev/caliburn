import { ChangeDetectionStrategy, Component } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Hints.tsx`'s
 * `MenuHint`. Host-bound (no wrapper element) — the tunnel it mounts through
 * upstream has no Angular equivalent; this is placed directly at the mount
 * point in `layer-ui.component.html` instead. Renders its default label only
 * — no consumer overrides the hint text in this task.
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
  protected readonly label = t("welcomeScreen.defaults.menuHint");
}
