import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { nativeFileSystemSupported } from "@excalidraw/excalidraw/data/filesystem";
import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import {
  actionChangeProjectName,
  actionSaveFileToDisk,
} from "../actions/actionExport";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import { CaliburnCardComponent } from "./card.component";
import { CaliburnDialogComponent } from "./dialog.component";
import { CaliburnIconButtonComponent } from "./icon-button.component";
import { CaliburnProjectNameComponent } from "./project-name.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `JSONExportDialog.tsx`. The `onExportToBackend`
 * card and `renderCustomUI` slot come from host-supplied `exportOpts`, which
 * caliburn's editor doesn't expose — only the "save to disk" card renders.
 * Upstream's `actionManager.renderAction("changeProjectName")` (a dropped
 * `PanelComponent`) is `caliburn-project-name` wired to the same action.
 */
@Component({
  selector: "caliburn-json-export-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnCardComponent,
    CaliburnDialogComponent,
    CaliburnIconButtonComponent,
    CaliburnProjectNameComponent,
    NgIcon,
  ],
  templateUrl: "./json-export-dialog.component.html",
})
export class CaliburnJSONExportDialogComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly title = translated(() => t("buttons.export"));
  protected readonly diskTitle = translated(() => t("exportDialog.disk_title"));
  protected readonly diskDetails = translated(() =>
    t("exportDialog.disk_details"),
  );
  protected readonly diskButton = translated(() =>
    t("exportDialog.disk_button"),
  );
  protected readonly fileTitleLabel = translated(() => t("labels.fileTitle"));
  protected readonly nativeFileSystemSupported = nativeFileSystemSupported;
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected visible() {
    this.editor.changeGeneration();
    return (
      !!this.editor.props.UIOptions.canvasActions.export &&
      this.editor.state.openDialog?.name === "jsonExport"
    );
  }

  protected exportOpts() {
    this.editor.changeGeneration();
    return this.editor.props.UIOptions.canvasActions.export as {
      saveFileToDisk?: boolean;
    };
  }

  protected projectName() {
    return this.editor.state.name ?? "";
  }

  protected setProjectName(name: string) {
    this.editor.actionManager.executeAction(
      actionChangeProjectName,
      "ui",
      name,
    );
  }

  protected readonly saveFileToDisk = () => {
    this.editor.actionManager.executeAction(actionSaveFileToDisk, "ui");
  };

  protected handleClose() {
    this.editor.batchCommits(() => this.editor.setState({ openDialog: null }));
  }
}
