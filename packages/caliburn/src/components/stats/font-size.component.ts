import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import {
  getBoundTextElement,
  hasBoundTextElement,
  isTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnStatsDragInputComponent } from "./drag-input.component";
import { getStepSizedValue } from "./utils";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import type { DragInputCallbackType } from "./drag-input.component";
import type { CaliburnEditorComponent } from "../../editor.component";

const MIN_FONT_SIZE = 4;
const STEP_SIZE = 4;

const handleFontSizeChange: DragInputCallbackType<
  "fontSize",
  ExcalidrawTextElement
> = ({
  accumulatedChange,
  originalElements,
  shouldChangeByStepSize,
  nextValue,
  scene,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();

  const origElement = originalElements[0];
  if (origElement) {
    const latestElement = elementsMap.get(origElement.id);
    if (!latestElement || !isTextElement(latestElement)) {
      return;
    }

    let nextFontSize;

    if (nextValue !== undefined) {
      nextFontSize = Math.max(Math.round(nextValue), MIN_FONT_SIZE);
    } else if (origElement.type === "text") {
      const originalFontSize = Math.round(origElement.fontSize);
      const changeInFontSize = Math.round(accumulatedChange);
      nextFontSize = Math.max(
        originalFontSize + changeInFontSize,
        MIN_FONT_SIZE,
      );
      if (shouldChangeByStepSize) {
        nextFontSize = getStepSizedValue(nextFontSize, STEP_SIZE);
      }
    }

    if (nextFontSize) {
      scene.mutateElement(latestElement, {
        fontSize: nextFontSize,
      });
      redrawTextBoundingBox(
        latestElement,
        scene.getContainerElement(latestElement),
        scene,
      );
    }
  }
};

/** Angular port of upstream `Stats/FontSize.tsx`. */
@Component({
  selector: "caliburn-stats-font-size",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnStatsDragInputComponent],
  templateUrl: "./font-size.component.html",
})
export class CaliburnStatsFontSizeComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly property = input.required<"fontSize">();
  readonly element = input.required<ExcalidrawElement>();

  protected readonly handleFontSizeChange = handleFontSizeChange;

  protected readonly textElements = computed(() => {
    this.editor.changeGeneration();
    const element = this.element();
    const textElement = isTextElement(element)
      ? element
      : hasBoundTextElement(element)
      ? getBoundTextElement(
          element,
          this.editor.scene.getNonDeletedElementsMap(),
        )
      : null;

    return textElement ? [textElement] : [];
  });

  protected readonly value = computed(() => {
    const [element] = this.textElements();
    return element ? Math.round(element.fontSize * 10) / 10 : 0;
  });
}
