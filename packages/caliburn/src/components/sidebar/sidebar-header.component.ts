import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import { CaliburnButtonComponent } from "../button.component";
import { CaliburnTooltipComponent } from "../tooltip.component";

import { translated } from "../../i18n";

import { CaliburnSidebarComponent } from "./sidebar.component";

/**
 * Angular port of upstream `Sidebar/SidebarHeader.tsx`. The host element IS
 * upstream's `.sidebar__header` div (`.sidebar-tabs-root > .sidebar__header`
 * in `Sidebar.scss` needs it to be a direct child of the tabs root).
 *
 * Upstream reads `onDock`/`docked`/`onCloseRequest` off `SidebarPropsContext`;
 * here the enclosing `caliburn-sidebar` is injected directly (see
 * `sidebar/common.ts`).
 */
@Component({
  selector: "caliburn-sidebar-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnButtonComponent, CaliburnTooltipComponent, NgIcon],
  host: {
    class: "sidebar__header",
    "data-testid": "sidebar-header",
  },
  templateUrl: "./sidebar-header.component.html",
})
export class CaliburnSidebarHeaderComponent {
  protected readonly sidebar = inject(CaliburnSidebarComponent);

  protected readonly lockLabel = translated(() => t("labels.sidebarLock"));
  protected readonly closeLabel = translated(() => t("buttons.close"));
}
