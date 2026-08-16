import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  output,
  signal,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import { CaliburnDialogComponent } from "./dialog.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `ErrorDialog.tsx`. `modalIsShown` mirrors
 * upstream's local state (it hides the dialog before the owner clears
 * `appState.errorMessage`); the message itself is projected, as upstream
 * takes it as `children`.
 */
@Component({
  selector: "caliburn-error-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDialogComponent],
  templateUrl: "./error-dialog.component.html",
})
export class CaliburnErrorDialogComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly close = output<void>();

  protected readonly title = translated(() => t("errorDialog.title"));
  protected readonly modalIsShown = signal(true);
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected handleClose() {
    this.modalIsShown.set(false);
    this.close.emit();
    // TODO: Fix the A11y issues so this is never needed since we should always
    // focus on last active element
    this.editor.focusContainer();
  }
}
