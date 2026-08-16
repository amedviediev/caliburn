import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from "@angular/core";

import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { t } from "@excalidraw/excalidraw/i18n";

import { translated } from "../i18n";

import { CaliburnDialogComponent } from "./dialog.component";
import { CaliburnFilledButtonComponent } from "./filled-button.component";
import { CaliburnTextFieldComponent } from "./text-field.component";

import type { OnDestroy } from "@angular/core";

const COPY_STATUS_TIMEOUT = 2000;

/**
 * Angular port of upstream `ShareableLinkDialog.tsx` — shown by a host app
 * after it exports the scene to a shareable link. `useCopyStatus` is the
 * `copyStatus` signal here.
 */
@Component({
  selector: "caliburn-shareable-link-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnDialogComponent,
    CaliburnFilledButtonComponent,
    CaliburnTextFieldComponent,
  ],
  templateUrl: "./shareable-link-dialog.component.html",
})
export class CaliburnShareableLinkDialogComponent implements OnDestroy {
  readonly link = input.required<string>();

  readonly closeRequest = output<void>();
  readonly errorMessage = output<string>();

  protected readonly copyStatus = signal<"success" | null>(null);
  protected readonly copyLinkLabel = translated(() => t("buttons.copyLink"));
  // upstream's copy names "Excalidraw server"; this app's own server is the
  // one actually holding the upload, whatever this deployment's backend is
  // configured to be
  protected readonly uploadedSecurelyLabel = translated(() =>
    t("alerts.uploadedSecurly").replace(/Excalidraw/g, "Caliburn"),
  );

  private copyStatusTimeout = 0;

  ngOnDestroy() {
    window.clearTimeout(this.copyStatusTimeout);
  }

  protected readonly copyLink = async () => {
    try {
      await copyTextToSystemClipboard(this.link());
    } catch (error: any) {
      this.errorMessage.emit(t("errors.copyToSystemClipboardFailed"));
    }

    this.copyStatus.set("success");
    window.clearTimeout(this.copyStatusTimeout);
    this.copyStatusTimeout = window.setTimeout(() => {
      this.copyStatus.set(null);
    }, COPY_STATUS_TIMEOUT);
  };
}
