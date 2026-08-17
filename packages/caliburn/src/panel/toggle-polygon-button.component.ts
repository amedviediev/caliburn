import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { isLineElement } from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";

import { actionTogglePolygon } from "../actions/actionLinearEditor";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnIconButtonComponent } from "../components/icon-button.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `actionTogglePolygon`'s `PanelComponent`
 * (`actionLinearEditor.tsx`), which the edges group renders after its two
 * radios. Upstream only shows it once every selected element already is a
 * polygon — the button exists to break one, not to make one.
 */
@Component({
  selector: "caliburn-toggle-polygon-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  templateUrl: "./toggle-polygon-button.component.html",
})
export class CaliburnTogglePolygonButtonComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private selectedElements() {
    const editor = this.host;
    editor.changeGeneration();
    return editor.scene.getSelectedElements({
      selectedElementIds: editor.state.selectedElementIds,
    });
  }

  /** upstream's early return: the button is absent unless every selected
   * element already is a polygon */
  protected visible() {
    const selectedElements = this.selectedElements();

    return (
      selectedElements.length > 0 &&
      !selectedElements.some(
        (element) =>
          !isLineElement(element) ||
          // only show polygon button if every selected element is already
          // a polygon, effectively showing this button only to allow for
          // disabling the polygon state
          !element.polygon ||
          element.points.length < 3,
      )
    );
  }

  protected allPolygon() {
    return this.selectedElements().every(
      (element) => isLineElement(element) && element.polygon,
    );
  }

  protected label() {
    return t(
      this.allPolygon()
        ? "labels.polygon.breakPolygon"
        : "labels.polygon.convertToPolygon",
    );
  }

  protected execute() {
    this.host.actionManager.executeAction(actionTogglePolygon, "ui");
  }
}
