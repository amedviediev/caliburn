import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

import { CaliburnFooterCenterComponent } from "../../../packages/caliburn/src/index";

import { CaliburnDebugFooterComponent } from "./debug-footer.component";
import { CaliburnAppEncryptedIconComponent } from "./encrypted-icon.component";

/**
 * Angular port of upstream `excalidraw-app/components/AppFooter.tsx` — the
 * footer-center content, filled into the editor's `footerCenter` slot. The
 * encryption badge is unconditional here, as it is upstream for every
 * non-Plus user.
 *
 * Upstream calls `isVisualDebuggerEnabled()` inline and re-reads it whenever
 * the app re-renders; `window.visualDebug` is not reactive, so caliburn takes
 * the answer as an input from the host, which owns the toggle.
 */
@Component({
  selector: "caliburn-app-footer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnAppEncryptedIconComponent,
    CaliburnDebugFooterComponent,
    CaliburnFooterCenterComponent,
  ],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./app-footer.component.html",
})
export class CaliburnAppFooterComponent {
  readonly visualDebuggerEnabled = input(false);

  /** upstream's `onChange` prop */
  readonly refresh = output<void>();
}
