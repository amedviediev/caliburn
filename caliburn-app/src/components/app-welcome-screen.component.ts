import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import {
  CaliburnWelcomeScreenCenterComponent,
  CaliburnWelcomeScreenHeadingComponent,
  CaliburnWelcomeScreenLogoComponent,
  CaliburnWelcomeScreenMenuComponent,
  CaliburnWelcomeScreenMenuItemHelpComponent,
  CaliburnWelcomeScreenMenuItemLiveCollaborationTriggerComponent,
  CaliburnWelcomeScreenMenuItemLoadSceneComponent,
} from "../../../packages/caliburn/src/index";

import { translated } from "../../../packages/caliburn/src/index";

/**
 * Angular port of upstream
 * `excalidraw-app/components/AppWelcomeScreen.tsx`. The Excalidraw+
 * signed-in heading and the "Sign up" menu item are dropped, leaving
 * upstream's guest composition: the three-line heading, the load-scene and
 * help items, and the collaboration trigger.
 *
 * Upstream renders one `<WelcomeScreen>` holding both the hints and the
 * center; caliburn's editor takes one template per outlet, so the app fills
 * `welcomeScreenCenter` from here and `welcomeScreenMenuHint` from its own
 * template (see `app.component.html`) — the toolbar and help hints keep the
 * editor's defaults, which are upstream's too.
 */
@Component({
  selector: "caliburn-app-welcome-screen",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnWelcomeScreenCenterComponent,
    CaliburnWelcomeScreenHeadingComponent,
    CaliburnWelcomeScreenLogoComponent,
    CaliburnWelcomeScreenMenuComponent,
    CaliburnWelcomeScreenMenuItemHelpComponent,
    CaliburnWelcomeScreenMenuItemLiveCollaborationTriggerComponent,
    CaliburnWelcomeScreenMenuItemLoadSceneComponent,
  ],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./app-welcome-screen.component.html",
})
export class CaliburnAppWelcomeScreenComponent {
  readonly isCollabEnabled = input(false);

  readonly collabDialogOpen = output<void>();

  protected readonly headingLines = translated(() => [
    t("welcomeScreen.app.center_heading"),
    t("welcomeScreen.app.center_heading_line2"),
    t("welcomeScreen.app.center_heading_line3"),
  ]);
}
