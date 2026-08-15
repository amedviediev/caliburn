import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
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
import type { OnDestroy, OnInit } from "@angular/core";

/**
 * Angular port of upstream `DefaultSidebar.tsx`, rendered from LayerUI's
 * `renderSidebars()` (with upstream's `__fallback` + dock `trackEvent`) or by
 * a host app from the editor's `sidebar` slot.
 *
 * `fallback` is upstream's `__fallback` prop: the LayerUI-rendered instance
 * carries it and steps aside while a host renders its own default sidebar,
 * which upstream resolves through `withInternalFallback`'s mount counter and
 * caliburn through `editor.hostDefaultSidebars`.
 *
 * `docked`/`onDock` are upstream's host knobs, with the same three-way
 * meaning: no `onDock` + no `docked` docks from
 * `appState.defaultSidebarDockedPreference` and stays user-dockable;
 * `onDock={false}` disables docking; a `docked` without an `onDock` listener
 * force-docks. The search tab force-docks regardless.
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
export class CaliburnDefaultSidebarComponent implements OnInit, OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly fallback = input(false);
  /** upstream's `docked`; `undefined` follows the appState preference */
  readonly docked = input<boolean | undefined>(undefined);
  /** upstream's `onDock`, including its `false` "disable docking" value */
  readonly onDock = input<((docked: boolean) => void) | false | undefined>(
    undefined,
  );

  protected readonly name = DEFAULT_SIDEBAR.name;
  protected readonly libraryTab = LIBRARY_SIDEBAR_TAB;
  protected readonly searchTab = CANVAS_SEARCH_TAB;

  ngOnInit() {
    if (!this.fallback()) {
      this.editor.hostDefaultSidebars.update((count) => count + 1);
    }
  }

  ngOnDestroy() {
    if (!this.fallback()) {
      this.editor.hostDefaultSidebars.update((count) => count - 1);
    }
  }

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected readonly isForceDocked = computed(
    () => this.state().openSidebar?.tab === CANVAS_SEARCH_TAB,
  );

  protected readonly isDocked = computed(
    () =>
      this.isForceDocked() ||
      (this.docked() ?? this.state().defaultSidebarDockedPreference),
  );

  /**
   * Upstream drops `onDock` — which is what makes the dock button render —
   * when docking is disabled, when the sidebar is force-docked, or when the
   * host pinned `docked` without listening for changes.
   */
  protected readonly isUserDockable = computed(() => {
    const onDock = this.onDock();
    return (
      !this.isForceDocked() &&
      onDock !== false &&
      (!!onDock || this.docked() === undefined)
    );
  });

  protected activeTab() {
    return this.state().openSidebar?.tab ?? null;
  }

  /** upstream composes the host's `onDock` with the default handler */
  protected readonly handleDock = (docked: boolean) => {
    const onDock = this.onDock();
    if (onDock) {
      onDock(docked);
    }
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
  };
}
