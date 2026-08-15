import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnDialogActionButtonComponent } from "./dialog-action-button.component";
import { CaliburnDialogComponent } from "./dialog.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `ConfirmDialog.tsx`. React's `flushSync` around
 * the confirm/cancel callbacks has no Angular counterpart (the emit and the
 * state write it guards are already synchronous), so the container refocus
 * simply follows them.
 */
@Component({
  selector: "caliburn-confirm-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDialogComponent, CaliburnDialogActionButtonComponent],
  template: `
    <caliburn-dialog
      [class]="dialogClass()"
      size="small"
      [title]="title()"
      [fullscreen]="isMobile"
      (closeRequest)="cancel.emit()"
    >
      <ng-content />
      <div class="confirm-dialog-buttons">
        <button
          caliburn-dialog-action-button
          [label]="cancelText()"
          (select)="handleCancel()"
        ></button>
        <button
          caliburn-dialog-action-button
          [label]="confirmText()"
          actionType="danger"
          (select)="handleConfirm()"
        ></button>
      </div>
    </caliburn-dialog>
  `,
})
export class CaliburnConfirmDialogComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly title = input<string | false>(false);
  readonly confirmText = input(t("buttons.confirm"));
  readonly cancelText = input(t("buttons.cancel"));
  readonly extraClass = input<string>("", { alias: "class" });

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected readonly dialogClass = computed(() =>
    `confirm-dialog ${this.extraClass()}`.trim(),
  );

  protected handleCancel() {
    this.editor.batchCommits(() => this.editor.setState({ openMenu: null }));
    this.cancel.emit();
    this.editor.focusContainer();
  }

  protected handleConfirm() {
    this.editor.batchCommits(() => this.editor.setState({ openMenu: null }));
    this.confirm.emit();
    this.editor.focusContainer();
  }
}
