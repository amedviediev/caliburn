import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
} from "@angular/core";

import { CLASSES, EVENT, KEYS, isDevEnv } from "@excalidraw/common";

import clsx from "clsx";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { isSidebarDocked } from "./common";

import type { CaliburnEditorComponent } from "../../editor.component";
import type { OnDestroy, OnInit } from "@angular/core";

/**
 * Angular port of upstream `Sidebar/Sidebar.tsx` (`Sidebar` + `SidebarInner`).
 *
 * Upstream's outer component gates the render on
 * `appState.openSidebar?.name === props.name`; here that gate lives in the
 * consumer's template (`default-sidebar.component.html`'s `@if`), so this
 * component only exists while the sidebar is open — which is also what makes
 * `ngOnInit`/`ngOnDestroy` the equivalent of upstream's mount effects.
 *
 * The host element IS upstream's `<Island class="sidebar">` — `.sidebar` is
 * absolutely positioned against the `.excalidraw` container and `> .Island`
 * combinators depend on there being no intervening node (see
 * `island.component.ts`).
 *
 * Upstream's `SidebarPropsContext` and the `mounted` render-deferral (a
 * fallback-vs-host-sidebar concern; caliburn renders only the default
 * sidebar) have no port — see `common.ts`.
 */
@Component({
  selector: "caliburn-sidebar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "hostClass()",
    "[attr.data-viewport-ui]": "viewportUi",
    "[attr.data-viewport-ui-name]": "viewportUiName",
  },
  templateUrl: "./sidebar.component.html",
})
export class CaliburnSidebarComponent implements OnInit, OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly name = input.required<string>();
  readonly docked = input<boolean | undefined>(undefined);
  readonly extraClass = input<string>("", { alias: "class" });
  /** upstream's `onDock` presence + `docked != null` — the two together are
   * what make the sidebar user-dockable (`SidebarHeader.tsx`) */
  readonly dockable = input(false);

  readonly dockToggle = output<boolean>();

  private readonly isPhone = this.editor.editorInterface.formFactor === "phone";

  readonly viewportUi = this.isPhone ? null : "side";
  readonly viewportUiName = this.isPhone ? null : "sidebar";

  readonly shouldRenderDockButton = computed(
    () => this.editor.editorInterface.canFitSidebar && this.dockable(),
  );

  readonly hostClass = computed(() =>
    clsx(
      "Island",
      CLASSES.SIDEBAR,
      { "sidebar--docked": this.docked() },
      this.extraClass(),
    ),
  );

  private readonly reportDocked = effect(() => {
    isSidebarDocked.set(!!this.docked());
  });

  onCloseRequest() {
    this.editor.batchCommits(() => this.editor.setState({ openSidebar: null }));
  }

  onDock(docked: boolean) {
    this.dockToggle.emit(docked);
  }

  ngOnInit() {
    if (isDevEnv() && this.dockable() && this.docked() == null) {
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
      event.key === KEYS.ESCAPE &&
      (!this.docked() || !this.editor.editorInterface.canFitSidebar)
    ) {
      this.closeSidebar();
    }
  };

  private readonly onOutsideClick = (event: Event) => {
    const node = this.host.nativeElement;
    const target = event.target as Element | null;

    if (!target) {
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
