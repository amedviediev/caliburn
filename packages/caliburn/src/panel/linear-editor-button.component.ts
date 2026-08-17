import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import { actionToggleLinearEditor } from "../actions/actionLinearEditor";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnIconButtonComponent } from "../components/icon-button.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `actionToggleLinearEditor`'s `PanelComponent`
 * (`actionLinearEditor.tsx`) — the line-editor button, which renders nothing
 * at all when the selection is empty and labels itself per element type.
 */
@Component({
  selector: "caliburn-linear-editor-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  templateUrl: "./linear-editor-button.component.html",
})
export class CaliburnLinearEditorButtonComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private selectedElement() {
    const editor = this.host;
    editor.changeGeneration();
    return editor.scene.getSelectedElements({
      selectedElementIds: editor.state.selectedElementIds,
    })[0] as ExcalidrawLinearElement | undefined;
  }

  protected label() {
    const selectedElement = this.selectedElement();

    if (!selectedElement) {
      return null;
    }

    return t(
      selectedElement.type === "arrow"
        ? "labels.lineEditor.editArrow"
        : "labels.lineEditor.edit",
    );
  }

  protected execute() {
    this.host.actionManager.executeAction(actionToggleLinearEditor, "ui");
  }
}
