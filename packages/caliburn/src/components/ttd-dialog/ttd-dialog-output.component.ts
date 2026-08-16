import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";
import {
  formatMermaidParseErrorMessage,
  getMermaidSyntaxErrorGuidance,
  isMermaidCaretLine,
} from "@excalidraw/excalidraw/components/TTDDialog/utils/mermaidError";

import { NgIcon } from "@ng-icons/core";

import { CaliburnButtonComponent } from "../button.component";
import { CaliburnSpinnerComponent } from "../spinner.component";

import type { ElementRef } from "@angular/core";

/**
 * Angular port of upstream `TTDDialog/TTDDialogOutput.tsx` — the preview
 * surface: the exported-canvas host plus the parse-error overlay.
 *
 * `hideErrorDetails` is dropped: only the AI tab (`TTDPreviewPanel.tsx`)
 * passes it, to swap the raw mermaid parse error for the generic
 * `chat.errors.mermaidParseError` string. With the AI tab gated out the prop
 * is always `false`, so the error message, the syntax guidance and the
 * auto-fix slot always render — exactly upstream's mermaid-tab behaviour.
 *
 * The canvas host element is exposed through {@link canvasElement} because
 * upstream threads it in as a `canvasRef` prop from `MermaidToExcalidraw`;
 * caliburn keeps the same ownership (the parent drives the render) but reads
 * the node back off the child instead of passing a ref down.
 */
@Component({
  selector: "caliburn-ttd-dialog-output",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnButtonComponent, CaliburnSpinnerComponent, NgIcon],
  templateUrl: "./ttd-dialog-output.component.html",
})
export class CaliburnTTDDialogOutputComponent {
  readonly error = input<Error | null>(null);
  readonly loaded = input(false);
  readonly sourceText = input<string>();
  readonly autoFixAvailable = input(false);

  readonly applyAutoFix = output<void>();

  protected readonly autoFixLabel = t("mermaid.autoFixAvailable");

  private readonly canvasContent =
    viewChild<ElementRef<HTMLDivElement>>("canvasContent");

  protected readonly errorMessageLines = computed(() => {
    const error = this.error();
    return error
      ? formatMermaidParseErrorMessage(error.message).split(/\r?\n/)
      : [];
  });

  protected readonly syntaxGuidance = computed(() => {
    const error = this.error();
    return error
      ? getMermaidSyntaxErrorGuidance(error.message, this.sourceText())
      : null;
  });

  protected readonly isCaretLine = isMermaidCaretLine;

  /** the `.ttd-dialog-output-canvas-content` node upstream hands to
   * `convertMermaidToExcalidraw` as `canvasRef` */
  canvasElement(): HTMLDivElement | null {
    return this.canvasContent()?.nativeElement ?? null;
  }
}
