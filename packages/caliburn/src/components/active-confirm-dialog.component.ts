import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { actionClearCanvas } from "../actions/actionCanvas";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnConfirmDialogComponent } from "./confirm-dialog.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `ActiveConfirmDialog.tsx`. Upstream's
 * `activeConfirmDialogAtom` (a per-editor jotai atom) is the editor's
 * `activeConfirmDialog` signal here.
 */
@Component({
  selector: "caliburn-active-confirm-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnConfirmDialogComponent],
  template: `
    @if (editor.activeConfirmDialog() === "clearCanvas") {
      <caliburn-confirm-dialog
        [title]="title"
        (confirm)="handleConfirm()"
        (cancel)="editor.activeConfirmDialog.set(null)"
      >
        <p class="clear-canvas__content">{{ content }}</p>
      </caliburn-confirm-dialog>
    }
  `,
})
export class CaliburnActiveConfirmDialogComponent {
  protected readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly title = t("clearCanvasDialog.title");
  protected readonly content = t("alerts.clearReset");

  protected handleConfirm() {
    this.editor.actionManager.executeAction(actionClearCanvas, "ui");
    this.editor.activeConfirmDialog.set(null);
  }
}
