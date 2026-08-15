import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Angular port of upstream `Sidebar/SidebarTabTriggers.tsx` (Radix's
 * `Tabs.List`). The host element IS upstream's `.sidebar-triggers` div.
 */
@Component({
  selector: "caliburn-sidebar-tab-triggers",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "sidebar-triggers",
    role: "tablist",
    "aria-orientation": "horizontal",
  },
  templateUrl: "./sidebar-tab-triggers.component.html",
})
export class CaliburnSidebarTabTriggersComponent {}
