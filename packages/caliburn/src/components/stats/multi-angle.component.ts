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
  isInGroup,
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
  property,
  scene,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const editableLatestIndividualElements = originalElements
    .map((el) => elementsMap.get(el.id))
    .filter((el) => el && !isInGroup(el) && isPropertyEditable(el, property));
  const editableOriginalIndividualElements = originalElements.filter(
    (el) => !isInGroup(el) && isPropertyEditable(el, property),
  );

  if (nextValue !== undefined) {
    const nextAngle = degreesToRadians(nextValue as Degrees);

    for (const element of editableLatestIndividualElements) {
      if (!element) {
        continue;
      }
      scene.mutateElement(element, {
        angle: nextAngle,
      });

      const boundTextElement = getBoundTextElement(element, elementsMap);
      if (boundTextElement && !isArrowElement(element)) {
        scene.mutateElement(boundTextElement, { angle: nextAngle });
      }
    }

    scene.triggerUpdate();

    return;
  }

  for (let i = 0; i < editableLatestIndividualElements.length; i++) {
    const latestElement = editableLatestIndividualElements[i];
    if (!latestElement) {
      continue;
    }
    const originalElement = editableOriginalIndividualElements[i];
    const originalAngleInDegrees =
      Math.round(radiansToDegrees(originalElement.angle) * 100) / 100;
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

    const boundTextElement = getBoundTextElement(latestElement, elementsMap);
    if (boundTextElement && !isArrowElement(latestElement)) {
      scene.mutateElement(boundTextElement, { angle: nextAngle });
    }
  }
  scene.triggerUpdate();
};

/** Angular port of upstream `Stats/MultiAngle.tsx`. */
@Component({
  selector: "caliburn-stats-multi-angle",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnStatsDragInputComponent],
  templateUrl: "./multi-angle.component.html",
})
export class CaliburnStatsMultiAngleComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly property = input.required<"angle">();
  readonly elements = input.required<readonly NonDeletedExcalidrawElement[]>();

  protected readonly handleDegreeChange = handleDegreeChange;

  private readonly editableElements = computed(() => {
    this.editor.changeGeneration();
    return this.elements().filter(
      (el) => !isInGroup(el) && isPropertyEditable(el, "angle"),
    );
  });

  protected readonly value = computed<number | "Mixed">(() => {
    const angles = this.editableElements().map(
      (el) => Math.round((radiansToDegrees(el.angle) % 360) * 100) / 100,
    );
    return new Set(angles).size === 1 ? angles[0] : "Mixed";
  });

  protected readonly editable = computed(() =>
    this.editableElements().some((el) => isPropertyEditable(el, "angle")),
  );
}
