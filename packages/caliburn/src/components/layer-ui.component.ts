import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";
import { CaliburnShapeActionsComponent } from "../panel/shape-actions.component";

import { CaliburnFixedSideContainerComponent } from "./fixed-side-container.component";
import { CaliburnFooterComponent } from "./footer.component";
import {
  CaliburnStackColComponent,
  CaliburnStackRowComponent,
} from "./stack.component";
import { CaliburnToolbarComponent } from "./toolbar.component";

import type { CaliburnEditorComponent } from "../editor.component";

let nextLayerUIId = 0;

/**
 * Angular port of upstream `LayerUI.tsx`'s desktop layout: the top fixed
 * side container (canvas actions / shape actions column, the shapes
 * toolbar, the top-right column) and the footer. Surfaces owned by later
 * slices — the main menu, welcome screen, sidebars, dialogs, stats, toasts
 * and the host-render props — are left as their (empty) upstream containers
 * rather than stubbed.
 *
 * Upstream nests the shapes `<Section>`'s heading inside the toolbar island
 * via `Section`'s render-function form; the caliburn `Section` primitive
 * only ports the plain-children form, so the `<section>` element is written
 * out here and the heading is rendered by `caliburn-toolbar`, keeping the
 * upstream DOM (`aria-labelledby` → the island's `<h2>`).
 */
@Component({
  selector: "caliburn-layer-ui",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnFixedSideContainerComponent,
    CaliburnFooterComponent,
    CaliburnShapeActionsComponent,
    CaliburnStackColComponent,
    CaliburnStackRowComponent,
    CaliburnToolbarComponent,
  ],
  template: `
    <div class="layer-ui__wrapper">
      <caliburn-fixed-side-container side="top">
        <div class="App-menu App-menu_top">
          <caliburn-stack-col [gap]="6" class="App-menu_top__left">
            <div style="position: relative">
              <div class="excalidraw-ui-top-left"></div>
            </div>
            <div class="selected-shape-actions-container">
              <caliburn-shape-actions />
            </div>
          </caliburn-stack-col>
          @if (!state().viewModeEnabled) {
            <section class="shapes-section" [attr.aria-labelledby]="headingId">
              <div style="position: relative">
                <caliburn-stack-col [gap]="4" align="start">
                  <caliburn-stack-row
                    [gap]="1"
                    class="App-toolbar-container"
                    [class.zen-mode]="state().zenModeEnabled"
                  >
                    <caliburn-toolbar [headingId]="headingId" />
                  </caliburn-stack-row>
                </caliburn-stack-col>
              </div>
            </section>
          }
          <div class="layer-ui__wrapper__top-right zen-mode-transition"></div>
        </div>
      </caliburn-fixed-side-container>
      <caliburn-footer />
    </div>
  `,
})
export class CaliburnLayerUIComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly headingId = `caliburn-layer-ui-${nextLayerUIId++}-shapes-title`;

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }
}
