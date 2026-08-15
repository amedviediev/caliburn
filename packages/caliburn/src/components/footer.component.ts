import {
  ChangeDetectionStrategy,
  Component,
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

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `footer/Footer.tsx` together with the
 * `ZoomActions` / `UndoRedoActions` islands it composes (`Actions.tsx`).
 * Upstream renders those two through `actionManager.renderAction`, which
 * mounts each action's React `PanelComponent`; caliburn's actions carry no
 * component, so the buttons are declared here and dispatch through
 * `actionManager.executeAction`. The footer-center tunnel, the help button
 * and the exit-zen-mode button are omitted — each needs a surface that has
 * no caliburn equivalent yet.
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
  ],
  template: `
    <footer
      role="contentinfo"
      class="layer-ui__wrapper__footer App-menu App-menu_bottom"
    >
      <div class="layer-ui__wrapper__footer-left zen-mode-transition">
        <caliburn-stack-col [gap]="2">
          <section caliburn-section heading="canvasActions">
            @if (isNavigationEnabled()) {
            <caliburn-stack-col [gap]="1" class="zoom-actions">
              <caliburn-stack-row align="center">
                <button
                  caliburn-icon-button
                  class="zoom-out-button zoom-button"
                  mode="button"
                  icon="zoomOutIcon"
                  [title]="labels.zoomOutTitle"
                  [ariaLabel]="labels.zoomOut"
                  [disabled]="state().zoom.value <= MIN_ZOOM"
                  [onClick]="zoomOut"
                ></button>
                <caliburn-tooltip [label]="labels.resetZoom">
                  <button
                    caliburn-icon-button
                    class="reset-zoom-button zoom-button"
                    mode="button"
                    [title]="labels.resetZoom"
                    [ariaLabel]="labels.resetZoom"
                    [onClick]="resetZoom"
                  >
                    {{ zoomPercentage() }}%
                  </button>
                </caliburn-tooltip>
                <button
                  caliburn-icon-button
                  class="zoom-in-button zoom-button"
                  mode="button"
                  icon="zoomInIcon"
                  [title]="labels.zoomInTitle"
                  [ariaLabel]="labels.zoomIn"
                  [disabled]="state().zoom.value >= MAX_ZOOM"
                  [onClick]="zoomIn"
                ></button>
              </caliburn-stack-row>
            </caliburn-stack-col>
            } @if (!state().viewModeEnabled) {
            <div class="undo-redo-buttons zen-mode-transition">
              <div class="undo-button-container">
                <caliburn-tooltip [label]="labels.undo">
                  <button
                    caliburn-icon-button
                    mode="button"
                    icon="undoIcon"
                    [ariaLabel]="labels.undo"
                    testId="button-undo"
                    [disabled]="isUndoStackEmpty()"
                    [onClick]="undo"
                  ></button>
                </caliburn-tooltip>
              </div>
              <div class="redo-button-container">
                <caliburn-tooltip [label]="labels.redo">
                  <button
                    caliburn-icon-button
                    mode="button"
                    icon="redoIcon"
                    [ariaLabel]="labels.redo"
                    testId="button-redo"
                    [disabled]="isRedoStackEmpty()"
                    [onClick]="redo"
                  ></button>
                </caliburn-tooltip>
              </div>
            </div>
            }
          </section>
        </caliburn-stack-col>
      </div>
      <div class="layer-ui__wrapper__footer-right zen-mode-transition">
        <div style="position: relative"></div>
      </div>
    </footer>
  `,
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
