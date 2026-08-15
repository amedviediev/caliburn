import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import { getNormalizedGridStep } from "@excalidraw/excalidraw/scene";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnStatsDragInputComponent } from "./drag-input.component";
import { getStepSizedValue } from "./utils";

import type { DragInputCallbackType } from "./drag-input.component";
import type { CaliburnEditorComponent } from "../../editor.component";

const STEP_SIZE = 5;

const handleGridStepChange: DragInputCallbackType<"gridStep"> = ({
  nextValue,
  instantChange,
  shouldChangeByStepSize,
  setInputValue,
  setAppState,
}) => {
  setAppState((state) => {
    let nextGridStep;

    if (nextValue) {
      nextGridStep = nextValue;
    } else if (instantChange) {
      nextGridStep = shouldChangeByStepSize
        ? getStepSizedValue(
            state.gridStep + STEP_SIZE * Math.sign(instantChange),
            STEP_SIZE,
          )
        : state.gridStep + instantChange;
    }

    if (!nextGridStep) {
      setInputValue(state.gridStep);
      return null;
    }

    nextGridStep = getNormalizedGridStep(nextGridStep);
    setInputValue(nextGridStep);
    return {
      gridStep: nextGridStep,
    };
  });
};

/** Angular port of upstream `Stats/CanvasGrid.tsx`. */
@Component({
  selector: "caliburn-stats-canvas-grid",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnStatsDragInputComponent],
  templateUrl: "./canvas-grid.component.html",
})
export class CaliburnStatsCanvasGridComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly property = input.required<"gridStep">();

  protected readonly handleGridStepChange = handleGridStepChange;
  protected readonly noElements: readonly ExcalidrawElement[] = [];

  protected readonly value = computed(() => {
    this.editor.changeGeneration();
    return this.editor.state.gridStep;
  });
}
