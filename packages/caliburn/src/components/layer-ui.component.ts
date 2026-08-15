import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR } from "@excalidraw/common";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";
import { CaliburnShapeActionsComponent } from "../panel/shape-actions.component";

import { CaliburnActiveConfirmDialogComponent } from "./active-confirm-dialog.component";
import { CaliburnCommandPaletteComponent } from "./command-palette/command-palette.component";
import { CaliburnErrorDialogComponent } from "./error-dialog.component";
import { CaliburnFixedSideContainerComponent } from "./fixed-side-container.component";
import { CaliburnFooterComponent } from "./footer.component";
import { CaliburnHelpDialogComponent } from "./help-dialog.component";
import { CaliburnImageExportDialogComponent } from "./image-export-dialog.component";
import { CaliburnIslandComponent } from "./island.component";
import { CaliburnJSONExportDialogComponent } from "./json-export-dialog.component";
import { CaliburnDefaultMainMenuComponent } from "./main-menu/default-main-menu.component";
import { CaliburnSearchMenuComponent } from "./search-menu.component";
import {
  CaliburnStackColComponent,
  CaliburnStackRowComponent,
} from "./stack.component";
import {
  CaliburnToastComponent,
  DEFAULT_TOAST_TIMEOUT,
} from "./toast.component";
import { CaliburnToolbarComponent } from "./toolbar.component";

import type { CaliburnEditorComponent } from "../editor.component";

let nextLayerUIId = 0;

/**
 * Angular port of upstream `LayerUI.tsx`'s desktop layout: the dialogs, the
 * top fixed side container (canvas actions / shape actions column, the shapes
 * toolbar, the top-right column) and the footer. Surfaces owned by later
 * slices — the welcome screen, sidebars, stats, toasts and the host-render
 * props — are left as their (empty) upstream containers rather than stubbed.
 *
 * Upstream mounts the search menu in the default sidebar's
 * `CANVAS_SEARCH_TAB` (`DefaultSidebar.tsx`), rendered from LayerUI's
 * `renderSidebars()` right after the `.layer-ui__wrapper`. The `Sidebar`
 * family is a later slice, so the menu is hosted here in a plain island
 * carrying the sidebar's own classes (`.sidebar.sidebar--docked
 * .default-sidebar` — the search tab force-docks upstream) in that same
 * position, with the menu's own DOM untouched. The sidebar's header, tab
 * triggers and close/dock buttons are not stubbed.
 *
 * Upstream nests the shapes `<Section>`'s heading inside the toolbar island
 * via `Section`'s render-function form; the caliburn `Section` primitive
 * only ports the plain-children form, so the `<section>` element is written
 * out here and the heading is rendered by `caliburn-toolbar`, keeping the
 * upstream DOM (`aria-labelledby` → the island's `<h2>`).
 */
@Component({
  selector: "caliburn-layer-ui",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnActiveConfirmDialogComponent,
    CaliburnCommandPaletteComponent,
    CaliburnDefaultMainMenuComponent,
    CaliburnErrorDialogComponent,
    CaliburnFixedSideContainerComponent,
    CaliburnFooterComponent,
    CaliburnHelpDialogComponent,
    CaliburnImageExportDialogComponent,
    CaliburnIslandComponent,
    CaliburnJSONExportDialogComponent,
    CaliburnSearchMenuComponent,
    CaliburnShapeActionsComponent,
    CaliburnStackColComponent,
    CaliburnStackRowComponent,
    CaliburnToastComponent,
    CaliburnToolbarComponent,
  ],
  template: `
    @if (state().errorMessage) {
      <caliburn-error-dialog (close)="clearErrorMessage()">{{
        state().errorMessage
      }}</caliburn-error-dialog>
    }
    @if (state().openDialog?.name === "help") {
      <caliburn-help-dialog (close)="closeDialog()" />
    }
    <caliburn-active-confirm-dialog />
    @if (
      uiOptions.canvasActions.saveAsImage &&
      state().openDialog?.name === "imageExport"
    ) {
      <caliburn-image-export-dialog />
    }
    <caliburn-json-export-dialog />
    <caliburn-command-palette />
    <div class="layer-ui__wrapper">
      <caliburn-fixed-side-container side="top">
        <div class="App-menu App-menu_top">
          <caliburn-stack-col [gap]="6" class="App-menu_top__left">
            <div style="position: relative">
              <div class="excalidraw-ui-top-left">
                <caliburn-default-main-menu />
              </div>
            </div>
            <div class="selected-shape-actions-container">
              <caliburn-shape-actions />
            </div>
          </caliburn-stack-col>
          @if (!state().viewModeEnabled) {
            <section class="shapes-section" [attr.aria-labelledby]="headingId">
              <div style="position: relative">
                <caliburn-stack-col [gap]="4" align="start">
                  <caliburn-stack-row
                    [gap]="1"
                    class="App-toolbar-container"
                    [class.zen-mode]="state().zenModeEnabled"
                  >
                    <caliburn-toolbar [headingId]="headingId" />
                  </caliburn-stack-row>
                </caliburn-stack-col>
              </div>
            </section>
          }
          <div class="layer-ui__wrapper__top-right zen-mode-transition"></div>
        </div>
      </caliburn-fixed-side-container>
      <caliburn-footer />
      @if (state().toast; as toast) {
        <div class="floating-status-stack">
          <caliburn-toast
            [message]="toast.message"
            [closable]="!!toast.closable"
            [duration]="toast.duration ?? defaultToastDuration"
            (close)="clearToast()"
          />
        </div>
      }
    </div>
    @if (isSearchSidebarOpen()) {
      <caliburn-island
        class="sidebar sidebar--docked default-sidebar"
        viewportUi="side"
        viewportUiName="sidebar"
      >
        <caliburn-search-menu />
      </caliburn-island>
    }
  `,
})
export class CaliburnLayerUIComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly headingId = `caliburn-layer-ui-${nextLayerUIId++}-shapes-title`;
  protected readonly uiOptions = this.editor.props.UIOptions;
  protected readonly defaultToastDuration = DEFAULT_TOAST_TIMEOUT;

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected isSearchSidebarOpen() {
    const openSidebar = this.state().openSidebar;
    return (
      openSidebar?.name === DEFAULT_SIDEBAR.name &&
      openSidebar.tab === CANVAS_SEARCH_TAB
    );
  }

  protected clearErrorMessage() {
    this.editor.batchCommits(() =>
      this.editor.setState({ errorMessage: null }),
    );
  }

  protected closeDialog() {
    this.editor.batchCommits(() => this.editor.setState({ openDialog: null }));
  }

  protected clearToast() {
    this.editor.batchCommits(() => this.editor.setState({ toast: null }));
  }
}
