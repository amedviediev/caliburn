import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";

import { CaliburnSidebarTabsComponent } from "./sidebar-tabs.component";

/**
 * Angular port of upstream `Sidebar/SidebarTabTrigger.tsx` (Radix's
 * `Tabs.Trigger` with `asChild`).
 *
 * Attribute-selector component (`button[caliburn-sidebar-tab-trigger]`): the
 * host IS upstream's `<button class="excalidraw-button sidebar-tab-trigger">`,
 * which `.sidebar-triggers .sidebar-tab-trigger` sizes as a direct child.
 */
@Component({
  selector: "button[caliburn-sidebar-tab-trigger]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: "button",
    role: "tab",
    class: "excalidraw-button sidebar-tab-trigger",
    "[attr.id]": "triggerId()",
    "[attr.aria-controls]": "contentId()",
    "[attr.aria-selected]": "isActive()",
    "[attr.data-state]": "isActive() ? 'active' : 'inactive'",
    "[attr.data-testid]": "testId() ?? null",
    "(click)": "onClick()",
  },
  templateUrl: "./sidebar-tab-trigger.component.html",
})
export class CaliburnSidebarTabTriggerComponent {
  private readonly tabs = inject(CaliburnSidebarTabsComponent);

  readonly tab = input.required<string>();
  readonly testId = input<string>();

  protected readonly triggerId = computed(() =>
    this.tabs.triggerId(this.tab()),
  );
  protected readonly contentId = computed(() =>
    this.tabs.contentId(this.tab()),
  );
  protected readonly isActive = computed(
    () => this.tabs.activeTab() === this.tab(),
  );

  onClick() {
    this.tabs.selectTab(this.tab());
  }
}
