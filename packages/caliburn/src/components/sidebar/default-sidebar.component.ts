import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
} from "@angular/core";

import {
  CANVAS_SEARCH_TAB,
  DEFAULT_SIDEBAR,
  LIBRARY_SIDEBAR_TAB,
} from "@excalidraw/common";

import { trackEvent } from "@excalidraw/excalidraw/analytics";

import { NgIcon } from "@ng-icons/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnLibraryMenuComponent } from "../library/library-menu.component";
import { CaliburnSearchMenuComponent } from "../search-menu.component";

import { CaliburnSidebarHeaderComponent } from "./sidebar-header.component";
import { CaliburnSidebarTabTriggerComponent } from "./sidebar-tab-trigger.component";
import { CaliburnSidebarTabTriggersComponent } from "./sidebar-tab-triggers.component";
import { CaliburnSidebarTabComponent } from "./sidebar-tab.component";
import { CaliburnSidebarTabsComponent } from "./sidebar-tabs.component";
import { CaliburnSidebarComponent } from "./sidebar.component";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `DefaultSidebar.tsx`, rendered from LayerUI's
 * `renderSidebars()` (with upstream's `__fallback` + dock `trackEvent`).
 *
 * Upstream's `docked`/`onDock` props are host-app knobs threaded through the
 * tunnels; caliburn has no host sidebar API, so this always takes upstream's
 * "no `docked` prop passed" branch — the dock preference comes from
 * `appState.defaultSidebarDockedPreference` and the search tab force-docks.
 *
 * `Sidebar.Tab` is gated with `@if` here rather than inside the tab component,
 * mirroring Radix's unmount-when-inactive (see `sidebar-tab.component.ts`).
 */
@Component({
  selector: "caliburn-default-sidebar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnLibraryMenuComponent,
    CaliburnSearchMenuComponent,
    CaliburnSidebarComponent,
    CaliburnSidebarHeaderComponent,
    CaliburnSidebarTabComponent,
    CaliburnSidebarTabTriggerComponent,
    CaliburnSidebarTabTriggersComponent,
    CaliburnSidebarTabsComponent,
    NgIcon,
  ],
  templateUrl: "./default-sidebar.component.html",
})
export class CaliburnDefaultSidebarComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly name = DEFAULT_SIDEBAR.name;
  protected readonly libraryTab = LIBRARY_SIDEBAR_TAB;
  protected readonly searchTab = CANVAS_SEARCH_TAB;

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected readonly isOpen = computed(
    () => this.state().openSidebar?.name === this.name,
  );

  protected readonly isForceDocked = computed(
    () => this.state().openSidebar?.tab === CANVAS_SEARCH_TAB,
  );

  protected readonly docked = computed(
    () => this.isForceDocked() || this.state().defaultSidebarDockedPreference,
  );

  protected readonly dockable = computed(() => !this.isForceDocked());

  protected activeTab() {
    return this.state().openSidebar?.tab ?? null;
  }

  protected onDock(docked: boolean) {
    trackEvent(
      "sidebar",
      `toggleDock (${docked ? "dock" : "undock"})`,
      `(${
        this.editor.editorInterface.formFactor === "phone"
          ? "mobile"
          : "desktop"
      })`,
    );
    this.editor.batchCommits(() =>
      this.editor.setState({ defaultSidebarDockedPreference: docked }),
    );
  }
}
