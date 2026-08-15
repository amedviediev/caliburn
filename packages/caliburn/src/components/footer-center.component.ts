import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `footer/FooterCenter.tsx` — the wrapper a host app
 * puts its footer content in. Upstream tunnels it into `Footer.tsx`'s
 * `FooterCenterTunnel.Out`; here the host hands the editor the template that
 * renders this component (the `footerCenter` slot, see
 * `editor.component.ts`) and the footer renders it at the same spot.
 *
 * Host-bound so the rendered DOM is exactly upstream's `.footer-center` div.
 */
@Component({
  selector: "caliburn-footer-center",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "footer-center zen-mode-transition",
    "[class.layer-ui__wrapper__footer-left--transition-bottom]":
      "state().zenModeEnabled",
  },
  templateUrl: "./footer-center.component.html",
})
export class CaliburnFooterCenterComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }
}
