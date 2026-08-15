import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { CaliburnWelcomeScreenMenuItemComponent } from "./menu-item.component";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `MenuItemLiveCollaborationTrigger`. Ported for API-surface parity per the
 * brief — not part of `<WelcomeScreen />`'s default center content (upstream
 * only composes it into a host app's own custom welcome screen, e.g.
 * excalidraw.com's `AppWelcomeScreen`) and not wired to any collaboration
 * surface in this task; `packages/excalidraw/components/live-collaboration/
 * LiveCollaborationTrigger.tsx` is restored but unported (Task 23 consumes
 * the collab pieces).
 */
@Component({
  selector: "caliburn-welcome-screen-menu-item-live-collaboration-trigger",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnWelcomeScreenMenuItemComponent],
  templateUrl: "./menu-item-live-collaboration-trigger.component.html",
})
export class CaliburnWelcomeScreenMenuItemLiveCollaborationTriggerComponent {
  readonly select = output<void>();

  protected readonly label = t("labels.liveCollaboration");
}
