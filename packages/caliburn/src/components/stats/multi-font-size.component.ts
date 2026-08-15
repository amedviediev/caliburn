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
  isInGroup,
  isTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnStatsDragInputComponent } from "./drag-input.component";
import { getStepSizedValue } from "./utils";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import type { DragInputCallbackType } from "./drag-input.component";
import type { CaliburnEditorComponent } from "../../editor.component";

const MIN_FONT_SIZE = 4;
const STEP_SIZE = 4;

const getApplicableTextElements = (
  elements: readonly (ExcalidrawElement | undefined)[],
  elementsMap: NonDeletedSceneElementsMap,
) =>
  elements.reduce((acc: ExcalidrawTextElement[], el) => {
    if (!el || isInGroup(el)) {
      return acc;
    }
    if (isTextElement(el)) {
      acc.push(el);
      return acc;
    }
    if (hasBoundTextElement(el)) {
      const boundTextElement = getBoundTextElement(el, elementsMap);
      if (boundTextElement) {
        acc.push(boundTextElement);
        return acc;
      }
    }

    return acc;
  }, []);

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
  const latestTextElements = originalElements.map((el) =>
    elementsMap.get(el.id),
  ) as ExcalidrawTextElement[];

  let nextFontSize;

  if (nextValue) {
    nextFontSize = Math.max(Math.round(nextValue), MIN_FONT_SIZE);

    for (const textElement of latestTextElements) {
      scene.mutateElement(textElement, {
        fontSize: nextFontSize,
      });

      redrawTextBoundingBox(
        textElement,
        scene.getContainerElement(textElement),
        scene,
      );
    }

    scene.triggerUpdate();
  } else {
    const originalTextElements = originalElements as ExcalidrawTextElement[];

    for (let i = 0; i < latestTextElements.length; i++) {
      const latestElement = latestTextElements[i];
      const originalElement = originalTextElements[i];

      const originalFontSize = Math.round(originalElement.fontSize);
      const changeInFontSize = Math.round(accumulatedChange);
      let nextFontSize = Math.max(
        originalFontSize + changeInFontSize,
        MIN_FONT_SIZE,
      );
      if (shouldChangeByStepSize) {
        nextFontSize = getStepSizedValue(nextFontSize, STEP_SIZE);
      }
      scene.mutateElement(latestElement, {
        fontSize: nextFontSize,
      });

      redrawTextBoundingBox(
        latestElement,
        scene.getContainerElement(latestElement),
        scene,
      );
    }

    scene.triggerUpdate();
  }
};

/** Angular port of upstream `Stats/MultiFontSize.tsx`. */
@Component({
  selector: "caliburn-stats-multi-font-size",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnStatsDragInputComponent],
  templateUrl: "./multi-font-size.component.html",
})
export class CaliburnStatsMultiFontSizeComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly property = input.required<"fontSize">();
  readonly elements = input.required<readonly ExcalidrawElement[]>();

  protected readonly handleFontSizeChange = handleFontSizeChange;

  protected readonly textElements = computed(() => {
    this.editor.changeGeneration();
    return getApplicableTextElements(
      this.elements(),
      this.editor.scene.getNonDeletedElementsMap(),
    );
  });

  protected readonly value = computed<number | "Mixed">(() => {
    const fontSizes = this.textElements().map(
      (textEl) => Math.round(textEl.fontSize * 10) / 10,
    );
    return new Set(fontSizes).size === 1 ? fontSizes[0] : "Mixed";
  });

  protected readonly editable = computed(() => this.textElements().length > 0);
}
