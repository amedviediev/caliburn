import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import type { CaliburnEditorComponent } from "../../editor.component";

let nextSidebarTabsId = 0;

/**
 * Angular port of upstream `Sidebar/SidebarTabs.tsx`. Radix's `Tabs.Root`
 * (value/onValueChange context, generated ids, `data-orientation`) is
 * replaced by this component, which the tab and trigger components reach
 * through the element injector; the rendered contract kept is the
 * `.sidebar-tabs-root` class plus the `role`/`data-state`/`aria-*` wiring the
 * tab and trigger components carry (`Sidebar.scss` styles off
 * `[role="tabpanel"]` and `[data-state="active"]`).
 *
 * Upstream returns `null` while `appState.openSidebar` is unset; caliburn
 * only ever renders this inside an open sidebar, so the guard has no port.
 */
@Component({
  selector: "caliburn-sidebar-tabs",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "sidebar-tabs-root" },
  templateUrl: "./sidebar-tabs.component.html",
})
export class CaliburnSidebarTabsComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private readonly instanceId = `caliburn-sidebar-tabs-${nextSidebarTabsId++}`;

  activeTab() {
    this.editor.changeGeneration();
    return this.editor.state.openSidebar?.tab ?? null;
  }

  selectTab(tab: string) {
    this.editor.batchCommits(() =>
      this.editor.setState((state) => ({
        openSidebar: state.openSidebar
          ? { name: state.openSidebar.name, tab }
          : null,
      })),
    );
  }

  triggerId(tab: string) {
    return `${this.instanceId}-trigger-${tab}`;
  }

  contentId(tab: string) {
    return `${this.instanceId}-content-${tab}`;
  }
}
