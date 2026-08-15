import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
} from "@angular/core";

import { MAX_ZOOM, MIN_ZOOM } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import {
  actionResetZoom,
  actionZoomIn,
  actionZoomOut,
} from "../actions/actionCanvas";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnIconButtonComponent } from "./icon-button.component";
import { CaliburnSectionComponent } from "./section.component";
import {
  CaliburnStackColComponent,
  CaliburnStackRowComponent,
} from "./stack.component";
import { CaliburnTooltipComponent } from "./tooltip.component";
import { CaliburnWelcomeScreenHelpHintComponent } from "./welcome-screen/help-hint.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `footer/Footer.tsx` together with the
 * `ZoomActions` / `UndoRedoActions` islands it composes (`Actions.tsx`).
 * Upstream renders those two through `actionManager.renderAction`, which
 * mounts each action's React `PanelComponent`; caliburn's actions carry no
 * component, so the buttons are declared here and dispatch through
 * `actionManager.executeAction`. The footer-center tunnel, the help button
 * and the exit-zen-mode button are omitted — each needs a surface that has
 * no caliburn equivalent yet. The welcome screen's `HelpHint` is mounted at
 * its upstream tunnel spot (`layer-ui__wrapper__footer-right`'s
 * `position: relative` box, sibling to the omitted `HelpButton`).
 */
@Component({
  selector: "caliburn-footer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnIconButtonComponent,
    CaliburnSectionComponent,
    CaliburnStackColComponent,
    CaliburnStackRowComponent,
    CaliburnTooltipComponent,
    CaliburnWelcomeScreenHelpHintComponent,
  ],
  templateUrl: "./footer.component.html",
})
export class CaliburnFooterComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly MIN_ZOOM = MIN_ZOOM;
  protected readonly MAX_ZOOM = MAX_ZOOM;

  protected readonly labels = {
    zoomIn: t("buttons.zoomIn"),
    zoomInTitle: `${t("buttons.zoomIn")} — ${getShortcutKey("CtrlOrCmd++")}`,
    zoomOut: t("buttons.zoomOut"),
    zoomOutTitle: `${t("buttons.zoomOut")} — ${getShortcutKey("CtrlOrCmd+-")}`,
    resetZoom: t("buttons.resetZoom"),
    undo: t("buttons.undo"),
    redo: t("buttons.redo"),
  };

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected readonly renderWelcomeScreen = computed(() => {
    this.state();
    return this.editor.renderWelcomeScreen();
  });

  protected isNavigationEnabled() {
    return this.editor.isNavigationEnabled();
  }

  protected zoomPercentage() {
    return (this.state().zoom.value * 100).toFixed(0);
  }

  protected isUndoStackEmpty() {
    this.editor.changeGeneration();
    return this.editor.history.isUndoStackEmpty;
  }

  protected isRedoStackEmpty() {
    this.editor.changeGeneration();
    return this.editor.history.isRedoStackEmpty;
  }

  protected readonly zoomIn = () => {
    this.editor.actionManager.executeAction(actionZoomIn, "ui");
  };

  protected readonly zoomOut = () => {
    this.editor.actionManager.executeAction(actionZoomOut, "ui");
  };

  protected readonly resetZoom = () => {
    this.editor.actionManager.executeAction(actionResetZoom, "ui");
  };

  protected readonly undo = () => {
    this.editor.actionManager.executeAction(this.editor.undoAction, "ui");
  };

  protected readonly redo = () => {
    this.editor.actionManager.executeAction(this.editor.redoAction, "ui");
  };
}
