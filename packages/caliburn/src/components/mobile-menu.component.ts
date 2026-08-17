import { NgTemplateOutlet } from "@angular/common";
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
import {
  SCROLLBAR_MARGIN,
  SCROLLBAR_WIDTH,
} from "@excalidraw/excalidraw/scene/scrollbars";
import { getScrollToContentState } from "@excalidraw/excalidraw/viewport";

import { NgIcon } from "@ng-icons/core";

import { actionToggleViewMode } from "../actions/actionToggleViewMode";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";
import { CaliburnCompactShapeActionsComponent } from "../panel/compact-shape-actions.component";

import { translated } from "../i18n";

import { CaliburnFixedSideContainerComponent } from "./fixed-side-container.component";
import { CaliburnIslandComponent } from "./island.component";
import { CaliburnDefaultMainMenuComponent } from "./main-menu/default-main-menu.component";
import { CaliburnMobileToolbarComponent } from "./mobile-toolbar.component";
import { CaliburnSidebarTriggerComponent } from "./sidebar/sidebar-trigger.component";
import { CaliburnViewportStatusBadgeComponent } from "./viewport-status-frame/viewport-status-badge.component";
import { CaliburnWelcomeScreenCenterComponent } from "./welcome-screen/center.component";
import { CaliburnWelcomeScreenHeadingComponent } from "./welcome-screen/heading.component";
import { CaliburnWelcomeScreenLogoComponent } from "./welcome-screen/logo.component";
import { CaliburnWelcomeScreenMenuItemHelpComponent } from "./welcome-screen/menu-item-help.component";
import { CaliburnWelcomeScreenMenuItemLoadSceneComponent } from "./welcome-screen/menu-item-load-scene.component";
import { CaliburnWelcomeScreenMenuComponent } from "./welcome-screen/menu.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `MobileMenu.tsx` — the whole phone layout, which
 * replaces the desktop one (`layer-ui.component.html` picks between them on
 * `formFactor === "phone"`, as upstream's `LayerUI` does): a bottom bar
 * holding the mobile styles panel and the compact toolbar, and a top bar
 * holding the main menu and the sidebar trigger.
 *
 * Upstream also renders the pen-mode button in the top-right column; caliburn
 * has no `togglePenMode` port, so — exactly as in the desktop toolbar — that
 * button is omitted rather than stubbed. The sidebars, which upstream renders
 * from inside both branches, are rendered once by `layer-ui.component.html`
 * outside the branch instead.
 */
@Component({
  selector: "caliburn-mobile-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    NgTemplateOutlet,
    CaliburnCompactShapeActionsComponent,
    CaliburnDefaultMainMenuComponent,
    CaliburnFixedSideContainerComponent,
    CaliburnIslandComponent,
    CaliburnMobileToolbarComponent,
    CaliburnSidebarTriggerComponent,
    CaliburnViewportStatusBadgeComponent,
    CaliburnWelcomeScreenCenterComponent,
    CaliburnWelcomeScreenHeadingComponent,
    CaliburnWelcomeScreenLogoComponent,
    CaliburnWelcomeScreenMenuComponent,
    CaliburnWelcomeScreenMenuItemHelpComponent,
    CaliburnWelcomeScreenMenuItemLoadSceneComponent,
  ],
  templateUrl: "./mobile-menu.component.html",
})
export class CaliburnMobileMenuComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly bottomBarMargin = SCROLLBAR_WIDTH + SCROLLBAR_MARGIN;
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
  protected readonly topRightUI = this.editor.topRightUI;
  protected readonly welcomeScreenCenter = this.editor.welcomeScreenCenter;
  protected readonly viewportStatusFrame = this.editor.viewportStatusFrame;

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected defaultUIEnabled() {
    return this.editor.isDefaultUIEnabled();
  }

  protected isInteractionEnabled() {
    return this.editor.isInteractionEnabled();
  }

  protected scrollBackToContentUIEnabled() {
    return this.editor.isUIControlEnabled("scrollBackToContent");
  }

  protected readonly renderWelcomeScreen = computed(() => {
    this.state();
    return this.editor.renderWelcomeScreen();
  });

  protected shouldRenderDefaultBottomBar() {
    return this.defaultUIEnabled() && !this.state().viewModeEnabled;
  }

  protected showScrollBackToContent() {
    const state = this.state();
    return (
      this.scrollBackToContentUIEnabled() &&
      state.scrolledOutside &&
      !state.openMenu &&
      !state.openSidebar
    );
  }

  protected showSidebarTrigger() {
    return this.defaultUIEnabled() && !this.state().viewModeEnabled;
  }

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

  protected exitViewMode() {
    this.editor.actionManager.executeAction(actionToggleViewMode, "ui");
  }
}
