import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import {
  actionChangeExportEmbedScene,
  actionSaveFileToDisk,
} from "../../actions/actionExport";
import { CaliburnDialogComponent } from "../dialog.component";
import { CaliburnFilledButtonComponent } from "../filled-button.component";

import { translated } from "../../i18n";

import type { CaliburnEditorComponent } from "../../editor.component";

/** the `<bold>…</bold>` / `<br></br>` markers upstream's `<Trans>` resolves
 * in the overwrite-confirm descriptions, as flat runs per line */
const parseDescription = (raw: string) =>
  raw.split("<br></br>").map((line) =>
    line.split(/<bold>|<\/bold>/).map((text, index) => ({
      text,
      bold: index % 2 === 1,
    })),
  );

/**
 * Angular port of upstream `OverwriteConfirm/OverwriteConfirm.tsx` together
 * with `OverwriteConfirmActions.tsx`'s `Actions` / `Action` / `SaveToDisk` /
 * `ExportToImage`. Upstream composes those through a tunnel so a host app can
 * add its own actions; caliburn has no host-app composition API, so the two
 * default actions upstream's own `DefaultOverwriteConfirmDialog`
 * (`LayerUI.tsx`) mounts are written out here in the same order.
 */
@Component({
  selector: "caliburn-overwrite-confirm",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDialogComponent, CaliburnFilledButtonComponent, NgIcon],
  templateUrl: "./overwrite-confirm.component.html",
})
export class CaliburnOverwriteConfirmComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly labels = translated(() => ({
    saveToDiskTitle: t("overwriteConfirm.action.saveToDisk.title"),
    saveToDiskButton: t("overwriteConfirm.action.saveToDisk.button"),
    saveToDiskDescription: t("overwriteConfirm.action.saveToDisk.description"),
    exportToImageTitle: t("overwriteConfirm.action.exportToImage.title"),
    exportToImageButton: t("overwriteConfirm.action.exportToImage.button"),
    exportToImageDescription: t(
      "overwriteConfirm.action.exportToImage.description",
    ),
  }));

  protected readonly state = computed(() => this.editor.overwriteConfirm());

  protected readonly descriptionLines = computed(() => {
    const state = this.state();
    return state.active
      ? parseDescription(t(state.descriptionKey as TranslationKeys))
      : [];
  });

  protected handleClose() {
    const state = this.state();
    if (state.active) {
      state.onClose();
    }
    this.editor.overwriteConfirm.set({ active: false });
  }

  protected readonly handleConfirm = () => {
    const state = this.state();
    if (state.active) {
      state.onConfirm();
    }
    this.editor.overwriteConfirm.set({ active: false });
  };

  protected readonly saveToDisk = () => {
    this.editor.actionManager.executeAction(actionSaveFileToDisk, "ui");
  };

  protected readonly exportToImage = () => {
    this.editor.actionManager.executeAction(
      actionChangeExportEmbedScene,
      "ui",
      true,
    );
    this.editor.batchCommits(() =>
      this.editor.setState({ openDialog: { name: "imageExport" } }),
    );
  };
}
