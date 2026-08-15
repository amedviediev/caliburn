import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";

import { CaliburnSpinnerComponent } from "../../../packages/caliburn/src/index";

import type { SafeHtml } from "@angular/platform-browser";

/**
 * Angular port of upstream `excalidraw-app/share/QRCode.tsx`: renders the
 * room link as a QR code, loading the generator lazily. The generated markup
 * is trusted (it never leaves `uqr`), so it is bypassed into the template the
 * way upstream's `dangerouslySetInnerHTML` does.
 */
@Component({
  selector: "caliburn-app-qrcode",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnSpinnerComponent],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./qrcode.component.html",
})
export class CaliburnAppQRCodeComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly value = input.required<string>();

  protected readonly svg = signal<SafeHtml | null>(null);
  protected readonly failed = signal(false);

  private readonly generate = effect((onCleanup) => {
    const value = this.value();
    let current = true;

    onCleanup(() => {
      current = false;
    });

    import("./qrcode.chunk")
      .then(({ generateQRCodeSVG }) => {
        if (!current) {
          return;
        }
        try {
          this.svg.set(
            this.sanitizer.bypassSecurityTrustHtml(generateQRCodeSVG(value)),
          );
        } catch {
          this.failed.set(true);
        }
      })
      .catch(() => {
        if (current) {
          this.failed.set(true);
        }
      });
  });
}
