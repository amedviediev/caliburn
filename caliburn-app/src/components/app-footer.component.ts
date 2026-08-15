import { ChangeDetectionStrategy, Component } from "@angular/core";

import { CaliburnFooterCenterComponent } from "../../../packages/caliburn/src/index";

import { CaliburnAppEncryptedIconComponent } from "./encrypted-icon.component";

/**
 * Angular port of upstream `excalidraw-app/components/AppFooter.tsx` — the
 * footer-center content, filled into the editor's `footerCenter` slot. The
 * visual debugger's footer is not ported (no debug canvas), so only the
 * encryption badge remains, which upstream also renders for every
 * non-Plus user.
 */
@Component({
  selector: "caliburn-app-footer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnAppEncryptedIconComponent, CaliburnFooterCenterComponent],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./app-footer.component.html",
})
export class CaliburnAppFooterComponent {}
