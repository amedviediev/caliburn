import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";

import { CLASSES, EVENT, KEYS, isDevEnv } from "@excalidraw/common";

import clsx from "clsx";

import type { AppState } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { isSidebarDocked } from "./common";

import type { CaliburnEditorComponent } from "../../editor.component";
import type { ElementRef, OnDestroy, OnInit } from "@angular/core";

/**
 * Angular port of upstream `Sidebar/Sidebar.tsx` (`Sidebar` + `SidebarInner`).
 *
 * Like upstream, the component itself gates on
 * `appState.openSidebar?.name === name`, so a host app can drop it into the
 * editor's `sidebar` slot and let the editor decide when it shows. An Angular
 * component can't remove its own host element, so the `<div class="Island
 * sidebar">` upstream renders is written inside the template and the
 * `caliburn-sidebar` element around it is `display: contents` (see
 * `styles.scss`) — `.sidebar` is absolutely positioned against the
 * `.excalidraw` container, which stays its offset parent.
 *
 * Upstream's `SidebarPropsContext` and the `mounted` render-deferral (a
 * fallback-vs-host-sidebar concern, resolved here by the host slot being a
 * plain input) have no port — see `common.ts`.
 */
@Component({
  selector: "caliburn-sidebar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./sidebar.component.html",
})
export class CaliburnSidebarComponent implements OnInit, OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly name = input.required<string>();
  readonly docked = input<boolean | undefined>(undefined);
  /** upstream's `className`, applied to the `.sidebar` island */
  readonly sidebarClass = input<string>("");
  /** upstream's `onDock` — supplying it (together with `docked`) is what
   * makes the sidebar user-dockable (`SidebarHeader.tsx`) */
  readonly onDock = input<((docked: boolean) => void) | undefined>(undefined);

  /** upstream's `onStateChange`: this sidebar's `appState.openSidebar` slice */
  readonly stateChange = output<AppState["openSidebar"]>();

  private readonly island = viewChild<ElementRef<HTMLDivElement>>("island");

  private readonly isPhone = computed(
    () => this.editor.editorInterface.formFactor === "phone",
  );

  readonly viewportUi = computed(() => (this.isPhone() ? null : "side"));
  readonly viewportUiName = computed(() => (this.isPhone() ? null : "sidebar"));

  readonly isOpen = computed(() => {
    this.editor.changeGeneration();
    return this.editor.state.openSidebar?.name === this.name();
  });

  readonly shouldRenderDockButton = computed(
    () =>
      this.editor.editorInterface.canFitSidebar &&
      !!this.onDock() &&
      this.docked() != null,
  );

  readonly islandClass = computed(() =>
    clsx(
      "Island",
      CLASSES.SIDEBAR,
      { "sidebar--docked": this.docked() },
      this.sidebarClass(),
    ),
  );

  private readonly reportDocked = effect(() => {
    isSidebarDocked.set(this.isOpen() && !!this.docked());
  });

  private previousOpenSidebar: AppState["openSidebar"] = null;

  private readonly reportStateChange = effect(() => {
    this.editor.changeGeneration();
    const openSidebar = this.editor.state.openSidebar;
    const previous = this.previousOpenSidebar;
    const name = this.name();

    if (
      ((!openSidebar && previous?.name === name) ||
        (openSidebar?.name === name && previous?.name !== name) ||
        previous?.name === name) &&
      openSidebar !== previous
    ) {
      this.stateChange.emit(openSidebar?.name !== name ? null : openSidebar);
    }
    this.previousOpenSidebar = openSidebar;
  });

  onCloseRequest() {
    this.editor.batchCommits(() => this.editor.setState({ openSidebar: null }));
  }

  handleDock(docked: boolean) {
    this.onDock()?.(docked);
  }

  ngOnInit() {
    if (isDevEnv() && this.onDock() && this.docked() == null) {
      console.warn(
        "Sidebar: `docked` must be set when `onDock` is supplied for the sidebar to be user-dockable. To hide this message, either pass `docked` or remove `onDock`",
      );
    }
    document.addEventListener(EVENT.POINTER_DOWN, this.onOutsideClick);
    document.addEventListener(EVENT.TOUCH_START, this.onOutsideClick);
    document.addEventListener(EVENT.KEYDOWN, this.onKeyDown);
  }

  ngOnDestroy() {
    document.removeEventListener(EVENT.POINTER_DOWN, this.onOutsideClick);
    document.removeEventListener(EVENT.TOUCH_START, this.onOutsideClick);
    document.removeEventListener(EVENT.KEYDOWN, this.onKeyDown);
    isSidebarDocked.set(false);
  }

  /** upstream's `closeLibrary` */
  private closeSidebar() {
    const isDialogOpen = !!document.querySelector(".Dialog");

    // Prevent closing if any dialog is open
    if (isDialogOpen) {
      return;
    }
    this.onCloseRequest();
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (
      this.isOpen() &&
      event.key === KEYS.ESCAPE &&
      (!this.docked() || !this.editor.editorInterface.canFitSidebar)
    ) {
      this.closeSidebar();
    }
  };

  private readonly onOutsideClick = (event: Event) => {
    const node = this.island()?.nativeElement;
    const target = event.target as Element | null;

    if (!node || !target || !this.isOpen()) {
      return;
    }

    if (node.contains(target) || !document.documentElement.contains(target)) {
      return;
    }

    if (
      target.closest("[data-radix-portal]") ||
      target.closest("[data-prevent-outside-click]")
    ) {
      return;
    }

    // If click on the library icon, do nothing so that LibraryButton
    // can toggle library menu
    if (target.closest(".sidebar-trigger")) {
      return;
    }

    if (!this.docked() || !this.editor.editorInterface.canFitSidebar) {
      this.closeSidebar();
    }
  };
}
