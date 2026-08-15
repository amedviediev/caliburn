import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
} from "@angular/core";

import { DEFAULT_SIDEBAR, capitalizeString } from "@excalidraw/common";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { t } from "@excalidraw/excalidraw/i18n";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";
import { CaliburnShapeActionsComponent } from "../panel/shape-actions.component";

import { CaliburnActiveConfirmDialogComponent } from "./active-confirm-dialog.component";
import { CaliburnCommandPaletteComponent } from "./command-palette/command-palette.component";
import { CaliburnErrorDialogComponent } from "./error-dialog.component";
import { CaliburnFixedSideContainerComponent } from "./fixed-side-container.component";
import { CaliburnFooterComponent } from "./footer.component";
import { CaliburnHelpDialogComponent } from "./help-dialog.component";
import { CaliburnImageExportDialogComponent } from "./image-export-dialog.component";
import { CaliburnJSONExportDialogComponent } from "./json-export-dialog.component";
import { CaliburnDefaultMainMenuComponent } from "./main-menu/default-main-menu.component";
import { isSidebarDocked } from "./sidebar/common";
import { CaliburnDefaultSidebarComponent } from "./sidebar/default-sidebar.component";
import { CaliburnSidebarTriggerComponent } from "./sidebar/sidebar-trigger.component";
import {
  CaliburnStackColComponent,
  CaliburnStackRowComponent,
} from "./stack.component";
import {
  CaliburnToastComponent,
  DEFAULT_TOAST_TIMEOUT,
} from "./toast.component";
import { CaliburnToolbarComponent } from "./toolbar.component";
import { CaliburnWelcomeScreenCenterComponent } from "./welcome-screen/center.component";
import { CaliburnWelcomeScreenHeadingComponent } from "./welcome-screen/heading.component";
import { CaliburnWelcomeScreenLogoComponent } from "./welcome-screen/logo.component";
import { CaliburnWelcomeScreenMenuHintComponent } from "./welcome-screen/menu-hint.component";
import { CaliburnWelcomeScreenMenuItemHelpComponent } from "./welcome-screen/menu-item-help.component";
import { CaliburnWelcomeScreenMenuItemLoadSceneComponent } from "./welcome-screen/menu-item-load-scene.component";
import { CaliburnWelcomeScreenMenuComponent } from "./welcome-screen/menu.component";
import { CaliburnWelcomeScreenToolbarHintComponent } from "./welcome-screen/toolbar-hint.component";

import type { CaliburnEditorComponent } from "../editor.component";

let nextLayerUIId = 0;

/**
 * Angular port of upstream `LayerUI.tsx`'s desktop layout: the dialogs, the
 * top fixed side container (canvas actions / shape actions column, the shapes
 * toolbar, the top-right column with the sidebar trigger), the footer, the
 * welcome screen and the sidebars. Surfaces owned by later slices — stats and
 * the host-render props — are left as their (empty) upstream containers
 * rather than stubbed.
 *
 * The welcome screen's default center content (`<WelcomeScreen />`'s own
 * fallback children) is composed here directly from the
 * `welcome-screen/` primitives, mirroring upstream's
 * `WelcomeScreen.Center`'s default branch — caliburn has no host-app
 * composition API to swap it out yet (see `center.component.ts`).
 *
 * Upstream nests the shapes `<Section>`'s heading inside the toolbar island
 * via `Section`'s render-function form; the caliburn `Section` primitive
 * only ports the plain-children form, so the `<section>` element is written
 * out here and the heading is rendered by `caliburn-toolbar`, keeping the
 * upstream DOM (`aria-labelledby` → the island's `<h2>`).
 *
 * Upstream tunnels the default sidebar's trigger from `DefaultSidebar.tsx`
 * into `.layer-ui__wrapper__top-right`; caliburn has no host-app sidebar API,
 * so the trigger is written where the tunnel outlet is.
 */
@Component({
  selector: "caliburn-layer-ui",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnActiveConfirmDialogComponent,
    CaliburnCommandPaletteComponent,
    CaliburnDefaultMainMenuComponent,
    CaliburnDefaultSidebarComponent,
    CaliburnErrorDialogComponent,
    CaliburnFixedSideContainerComponent,
    CaliburnFooterComponent,
    CaliburnHelpDialogComponent,
    CaliburnImageExportDialogComponent,
    CaliburnJSONExportDialogComponent,
    CaliburnShapeActionsComponent,
    CaliburnSidebarTriggerComponent,
    CaliburnStackColComponent,
    CaliburnStackRowComponent,
    CaliburnToastComponent,
    CaliburnToolbarComponent,
    CaliburnWelcomeScreenCenterComponent,
    CaliburnWelcomeScreenHeadingComponent,
    CaliburnWelcomeScreenLogoComponent,
    CaliburnWelcomeScreenMenuComponent,
    CaliburnWelcomeScreenMenuHintComponent,
    CaliburnWelcomeScreenMenuItemHelpComponent,
    CaliburnWelcomeScreenMenuItemLoadSceneComponent,
    CaliburnWelcomeScreenToolbarHintComponent,
  ],
  templateUrl: "./layer-ui.component.html",
})
export class CaliburnLayerUIComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly headingId = `caliburn-layer-ui-${nextLayerUIId++}-shapes-title`;
  protected readonly uiOptions = this.editor.props.UIOptions;
  protected readonly defaultToastDuration = DEFAULT_TOAST_TIMEOUT;
  protected readonly defaultSidebarName = DEFAULT_SIDEBAR.name;
  protected readonly defaultSidebarTab = DEFAULT_SIDEBAR.defaultTab;
  protected readonly libraryTitle = capitalizeString(t("toolBar.library"));
  protected readonly welcomeScreenHeading = t(
    "welcomeScreen.defaults.center_heading",
  );

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected readonly renderWelcomeScreen = computed(() => {
    this.state();
    return this.editor.renderWelcomeScreen();
  });

  protected readonly isSidebarDockedAndFits = computed(
    () =>
      !!this.state().openSidebar &&
      isSidebarDocked() &&
      this.editor.editorInterface.canFitSidebar,
  );

  protected readonly showSidebarTrigger = computed(() => {
    const state = this.state();
    return (
      !state.viewModeEnabled &&
      state.openDialog?.name !== "elementLinkSelector" &&
      // hide button when sidebar docked
      (!isSidebarDocked() || state.openSidebar?.name !== DEFAULT_SIDEBAR.name)
    );
  });

  protected onSidebarToggle(open: boolean) {
    if (open) {
      trackEvent(
        "sidebar",
        `${DEFAULT_SIDEBAR.name} (open)`,
        `button (${
          this.editor.editorInterface.formFactor === "phone"
            ? "mobile"
            : "desktop"
        })`,
      );
    }
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
