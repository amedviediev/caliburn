import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import { degreesToRadians, radiansToDegrees } from "@excalidraw/math";

import {
  getBoundTextElement,
  isArrowElement,
  isElbowArrow,
  updateBindings,
} from "@excalidraw/element";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnStatsDragInputComponent } from "./drag-input.component";
import { getStepSizedValue, isPropertyEditable } from "./utils";

import type { Degrees } from "@excalidraw/math";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { DragInputCallbackType } from "./drag-input.component";
import type { CaliburnEditorComponent } from "../../editor.component";

const STEP_SIZE = 15;

const handleDegreeChange: DragInputCallbackType<"angle"> = ({
  accumulatedChange,
  originalElements,
  shouldChangeByStepSize,
  nextValue,
  scene,
  app,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const origElement = originalElements[0];
  if (origElement && !isElbowArrow(origElement)) {
    const latestElement = elementsMap.get(origElement.id);
    if (!latestElement) {
      return;
    }

    if (nextValue !== undefined) {
      const nextAngle = degreesToRadians(nextValue as Degrees);
      scene.mutateElement(latestElement, {
        angle: nextAngle,
      });
      updateBindings(latestElement, scene, app.state);

      const boundTextElement = getBoundTextElement(latestElement, elementsMap);
      if (boundTextElement && !isArrowElement(latestElement)) {
        scene.mutateElement(boundTextElement, { angle: nextAngle });
      }

      return;
    }

    const originalAngleInDegrees =
      Math.round(radiansToDegrees(origElement.angle) * 100) / 100;
    const changeInDegrees = Math.round(accumulatedChange);
    let nextAngleInDegrees = (originalAngleInDegrees + changeInDegrees) % 360;
    if (shouldChangeByStepSize) {
      nextAngleInDegrees = getStepSizedValue(nextAngleInDegrees, STEP_SIZE);
    }

    nextAngleInDegrees =
      nextAngleInDegrees < 0 ? nextAngleInDegrees + 360 : nextAngleInDegrees;

    const nextAngle = degreesToRadians(nextAngleInDegrees as Degrees);

    scene.mutateElement(latestElement, {
      angle: nextAngle,
    });
    updateBindings(latestElement, scene, app.state);

    const boundTextElement = getBoundTextElement(latestElement, elementsMap);
    if (boundTextElement && !isArrowElement(latestElement)) {
      scene.mutateElement(boundTextElement, { angle: nextAngle });
    }
  }
};

/** Angular port of upstream `Stats/Angle.tsx`. */
@Component({
  selector: "caliburn-stats-angle",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnStatsDragInputComponent],
  templateUrl: "./angle.component.html",
})
export class CaliburnStatsAngleComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly property = input.required<"angle">();
  readonly element = input.required<NonDeletedExcalidrawElement>();

  protected readonly handleDegreeChange = handleDegreeChange;

  protected readonly elementList = computed(() => [this.element()]);

  protected readonly editable = computed(() =>
    isPropertyEditable(this.element(), "angle"),
  );

  protected readonly value = computed(() => {
    this.editor.changeGeneration();
    return (
      Math.round((radiansToDegrees(this.element().angle) % 360) * 100) / 100
    );
  });
}
