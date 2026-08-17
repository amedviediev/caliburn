import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { actionToggleCropEditor } from "../actions/actionCropEditor";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnIconButtonComponent } from "../components/icon-button.component";

import { translated } from "../i18n";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `actionToggleCropEditor`'s `PanelComponent`
 * (`actionCropEditor.tsx`) — the styles panel's "Actions" row crop button.
 */
@Component({
  selector: "caliburn-crop-editor-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  templateUrl: "./crop-editor-button.component.html",
})
export class CaliburnCropEditorButtonComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly label = translated(() => t("helpDialog.cropStart"));

  protected execute() {
    this.host.actionManager.executeAction(actionToggleCropEditor, "ui");
  }
}
