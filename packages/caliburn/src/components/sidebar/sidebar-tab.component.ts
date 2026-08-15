import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";

import { CaliburnSidebarTabsComponent } from "./sidebar-tabs.component";

/**
 * Angular port of upstream `Sidebar/SidebarTab.tsx` (Radix's `Tabs.Content`).
 * The host element IS the tab panel.
 *
 * Radix unmounts an inactive `Tabs.Content` (no `forceMount`), so caliburn's
 * consumers gate the element with `@if` instead — a component cannot remove
 * its own host, and putting the gate inside this template would still
 * instantiate the projected tab body (Angular creates projected content
 * eagerly in the declaring view).
 */
@Component({
  selector: "caliburn-sidebar-tab",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "tabpanel",
    tabindex: "0",
    "data-state": "active",
    "[attr.id]": "contentId()",
    "[attr.aria-labelledby]": "triggerId()",
    "[attr.data-testid]": "tab()",
  },
  templateUrl: "./sidebar-tab.component.html",
})
export class CaliburnSidebarTabComponent {
  private readonly tabs = inject(CaliburnSidebarTabsComponent);

  readonly tab = input.required<string>();

  protected readonly contentId = computed(() =>
    this.tabs.contentId(this.tab()),
  );
  protected readonly triggerId = computed(() =>
    this.tabs.triggerId(this.tab()),
  );
}
