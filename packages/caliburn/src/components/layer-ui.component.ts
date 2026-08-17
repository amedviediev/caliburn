import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
} from "@angular/core";

import {
  DEFAULT_SIDEBAR,
  capitalizeString,
  deriveStylesPanelMode,
} from "@excalidraw/common";

import { showSelectedShapeActions } from "@excalidraw/element";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { t } from "@excalidraw/excalidraw/i18n";
import { getScrollToContentState } from "@excalidraw/excalidraw/viewport";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";
import { CaliburnCompactShapeActionsComponent } from "../panel/compact-shape-actions.component";
import { CaliburnShapeActionsComponent } from "../panel/shape-actions.component";

import { translated } from "../i18n";

import { CaliburnActiveConfirmDialogComponent } from "./active-confirm-dialog.component";
import { CaliburnBraveMeasureTextErrorComponent } from "./brave-measure-text-error.component";
import { CaliburnCommandPaletteComponent } from "./command-palette/command-palette.component";
import { CaliburnElementLinkDialogComponent } from "./element-link-dialog.component";
import { CaliburnErrorDialogComponent } from "./error-dialog.component";
import { CaliburnFixedSideContainerComponent } from "./fixed-side-container.component";
import { CaliburnFooterComponent } from "./footer.component";
import { CaliburnHelpDialogComponent } from "./help-dialog.component";
import { CaliburnImageExportDialogComponent } from "./image-export-dialog.component";
import { CaliburnJSONExportDialogComponent } from "./json-export-dialog.component";
import { CaliburnDefaultMainMenuComponent } from "./main-menu/default-main-menu.component";
import { CaliburnMobileMenuComponent } from "./mobile-menu.component";
import { CaliburnOverwriteConfirmComponent } from "./overwrite-confirm/overwrite-confirm.component";
import { CaliburnPenModeButtonComponent } from "./pen-mode-button.component";
import { isSidebarDocked } from "./sidebar/common";
import { CaliburnStatsComponent } from "./stats/stats.component";
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
import { CaliburnTTDDialogComponent } from "./ttd-dialog/ttd-dialog.component";
import { CaliburnUserListComponent } from "./user-list.component";
import { CaliburnViewportStatusBadgeComponent } from "./viewport-status-frame/viewport-status-badge.component";
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
 * welcome screen and the sidebars.
 *
 * The host app's own chrome arrives two ways, mirroring upstream: plain
 * children (upstream's `{children}`, rendered first here through
 * `<ng-content>`) and the editor's host-composition slots, which stand in
 * for the LayerUI tunnels — each outlet below renders the host's template
 * when one was supplied and the built-in default otherwise (upstream's
 * `withInternalFallback`). See `editor.component.ts`.
 *
 * Upstream nests the shapes `<Section>`'s heading inside the toolbar island
 * via `Section`'s render-function form; the caliburn `Section` primitive
 * only ports the plain-children form, so the `<section>` element is written
 * out here and the heading is rendered by `caliburn-toolbar`, keeping the
 * upstream DOM (`aria-labelledby` → the island's `<h2>`).
 *
 * Upstream tunnels the default sidebar's trigger from `DefaultSidebar.tsx`
 * into `.layer-ui__wrapper__top-right`; caliburn's default sidebar has no
 * trigger of its own, so the trigger is written where the tunnel outlet is.
 */
@Component({
  selector: "caliburn-layer-ui",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    CaliburnActiveConfirmDialogComponent,
    CaliburnBraveMeasureTextErrorComponent,
    CaliburnCommandPaletteComponent,
    CaliburnDefaultMainMenuComponent,
    CaliburnDefaultSidebarComponent,
    CaliburnElementLinkDialogComponent,
    CaliburnErrorDialogComponent,
    CaliburnFixedSideContainerComponent,
    CaliburnFooterComponent,
    CaliburnCompactShapeActionsComponent,
    CaliburnHelpDialogComponent,
    CaliburnImageExportDialogComponent,
    CaliburnJSONExportDialogComponent,
    CaliburnMobileMenuComponent,
    CaliburnOverwriteConfirmComponent,
    CaliburnPenModeButtonComponent,
    CaliburnShapeActionsComponent,
    CaliburnSidebarTriggerComponent,
    CaliburnStackColComponent,
    CaliburnStackRowComponent,
    CaliburnStatsComponent,
    CaliburnToastComponent,
    CaliburnToolbarComponent,
    CaliburnTTDDialogComponent,
    CaliburnUserListComponent,
    CaliburnViewportStatusBadgeComponent,
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
  protected readonly defaultToastDuration = DEFAULT_TOAST_TIMEOUT;
  protected readonly defaultSidebarName = DEFAULT_SIDEBAR.name;
  protected readonly defaultSidebarTab = DEFAULT_SIDEBAR.defaultTab;
  protected readonly libraryTitle = translated(() =>
    capitalizeString(t("toolBar.library")),
  );
  protected readonly welcomeScreenHeading = translated(() =>
    t("welcomeScreen.defaults.center_heading"),
  );
  protected readonly scrollBackToContentLabel = translated(() =>
    t("buttons.scrollBackToContent"),
  );

  protected readonly mainMenu = this.editor.mainMenu;
  protected readonly topLeftUI = this.editor.topLeftUI;
  protected readonly welcomeScreenCenter = this.editor.welcomeScreenCenter;
  protected readonly welcomeScreenMenuHint = this.editor.welcomeScreenMenuHint;
  protected readonly welcomeScreenToolbarHint =
    this.editor.welcomeScreenToolbarHint;
  protected readonly topRightUI = this.editor.topRightUI;
  protected readonly sidebar = this.editor.sidebar;
  protected readonly currentUserControls = this.editor.currentUserControls;
  protected readonly userToFollow = this.editor.userToFollow;
  protected readonly viewportStatusFrame = this.editor.viewportStatusFrame;
  protected readonly hostDefaultSidebars = this.editor.hostDefaultSidebars;
  protected readonly braveMeasureTextError = this.editor.braveMeasureTextError;

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected uiOptions() {
    this.editor.changeGeneration();
    return this.editor.props.UIOptions;
  }

  protected readonly renderWelcomeScreen = computed(() => {
    this.state();
    return this.editor.renderWelcomeScreen();
  });

  /** upstream's `useEditorInterface()` / `useStylesPanelMode()` — read through
   * the editor-interface signal so a resize that changes the form factor
   * re-renders the layout, as a re-render does upstream */
  protected readonly isPhone = computed(
    () => this.editor.editorInterface.formFactor === "phone",
  );

  protected readonly isCompactStylesPanel = computed(
    () => deriveStylesPanelMode(this.editor.editorInterface) === "compact",
  );

  /** upstream's `spacing` table — the compact layout tightens the gaps */
  protected readonly spacing = computed(() =>
    this.isCompactStylesPanel()
      ? {
          menuTopGap: 4,
          toolbarColGap: 4,
          toolbarRowGap: 1,
          toolbarInnerRowGap: 0.5,
          islandPadding: 1,
          collabMarginLeft: 8,
        }
      : {
          menuTopGap: 6,
          toolbarColGap: 4,
          toolbarRowGap: 1,
          toolbarInnerRowGap: 1,
          islandPadding: 1,
          collabMarginLeft: 8,
        },
  );

  protected readonly isSidebarDockedAndFits = computed(
    () =>
      !!this.state().openSidebar &&
      isSidebarDocked() &&
      this.editor.editorInterface.canFitSidebar,
  );

  protected readonly elementLinkSourceId = computed(() => {
    const openDialog = this.state().openDialog;
    return openDialog?.name === "elementLinkSelector"
      ? openDialog.sourceElementId
      : null;
  });

  protected defaultUIEnabled() {
    return this.editor.isDefaultUIEnabled();
  }

  protected scrollBackToContentUIEnabled() {
    return this.editor.isUIControlEnabled("scrollBackToContent");
  }

  /** upstream's `shouldRenderSelectedShapeActions` — the styles panel's own
   * gate, which the floating compact pen-mode button rides on */
  protected readonly shouldRenderSelectedShapeActions = computed(() => {
    const state = this.state();
    return (
      this.editor.isDefaultUIEnabled() &&
      showSelectedShapeActions(state, this.editor.scene.getNonDeletedElements())
    );
  });

  protected readonly shouldShowStats = computed(() => {
    const state = this.state();
    return (
      this.editor.isDefaultUIEnabled() &&
      state.stats.open &&
      !state.zenModeEnabled &&
      !state.viewModeEnabled &&
      state.openDialog?.name !== "elementLinkSelector"
    );
  });

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

  protected clearBraveMeasureTextError() {
    this.editor.braveMeasureTextError.set(false);
  }

  protected clearErrorMessage() {
    this.editor.batchCommits(() =>
      this.editor.setState({ errorMessage: null }),
    );
  }

  protected closeDialog() {
    this.editor.batchCommits(() => this.editor.setState({ openDialog: null }));
  }

  /** upstream's `Toast` renders a `ReactNode`, so `AppState["toast"].message`
   * is typed as one; caliburn's toast renders text, and every message that
   * reaches it — `setToast`'s callers here and the hosts going through it —
   * is a string */
  protected toastMessage() {
    const message = this.state().toast?.message;
    return typeof message === "string" ? message : "";
  }

  protected clearToast() {
    this.editor.batchCommits(() => this.editor.setState({ toast: null }));
  }

  protected scrollBackToContent() {
    this.editor.batchCommits(() =>
      this.editor.setState((state) => ({
        ...getScrollToContentState(
          this.editor.scene.getNonDeletedElements(),
          state,
        ),
      })),
    );
  }
}
