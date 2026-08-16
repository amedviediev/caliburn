import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnDialogComponent } from "../dialog.component";

import { translated } from "../../i18n";

import { CaliburnMermaidToExcalidrawComponent } from "./mermaid-to-excalidraw.component";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `TTDDialog/TTDDialog.tsx` in its `__fallback`
 * shape — the one `LayerUI.tsx` mounts (`{appState.openDialog?.name ===
 * "ttd" && <TTDDialog __fallback />}`) when no host renders the AI-enabled
 * `<TTDDialog onTextSubmit={...} persistenceAdapter={...} />`.
 *
 * That fallback branch IS upstream-with-AI-disabled: `TTDDialogBase` renders
 * `<p className="dialog-mermaid-title">{t("mermaid.title")}</p>` instead of
 * `<TTDDialogTabTriggers>`, and skips the `text-to-diagram` `<TTDDialogTab>`
 * entirely, leaving the mermaid tab as the only content. Caliburn has no
 * host-composition API for the AI half (the Plus-gated `onTextSubmit` /
 * `TTDDialogTrigger` tunnel), so the fallback is the only branch that can
 * ever render and `withInternalFallback`'s mount counter has nothing to
 * count — hence no `__fallback` input here.
 *
 * `TTDDialogTabs` (Radix `Tabs.Root`) and `TTDDialogTab` (Radix
 * `Tabs.Content`) collapse into the plain `.ttd-dialog-tabs-root` /
 * `.ttd-dialog-content` divs they render: without triggers there is nothing
 * to switch to, so Radix's roving-tabindex a11y and upstream's
 * `onValueChange` (the modal min-height memo plus `setAppState({ openDialog:
 * { name: "ttd", tab } })`) are unreachable.
 */
@Component({
  selector: "caliburn-ttd-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDialogComponent, CaliburnMermaidToExcalidrawComponent],
  templateUrl: "./ttd-dialog.component.html",
})
export class CaliburnTTDDialogComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly title = translated(() => t("mermaid.title"));
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected handleClose() {
    this.editor.batchCommits(() => this.editor.setState({ openDialog: null }));
  }
}
