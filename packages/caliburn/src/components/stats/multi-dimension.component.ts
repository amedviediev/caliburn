import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import { pointFrom } from "@excalidraw/math";

import { MIN_WIDTH_OR_HEIGHT } from "@excalidraw/common";
import {
  getBoundTextElement,
  getElementsInResizingFrame,
  getNonDeletedElements,
  handleBindTextResize,
  isFrameLikeElement,
  isTextElement,
  replaceAllElementsInFrame,
  rescalePointsInElement,
  resizeSingleElement,
  updateBoundElements,
} from "@excalidraw/element";

import { getCommonBounds } from "@excalidraw/utils";

import type { GlobalPoint } from "@excalidraw/math";

import type { Scene } from "@excalidraw/element";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnStatsDragInputComponent } from "./drag-input.component";
import {
  getAtomicUnits,
  getElementsInAtomicUnit,
  getStepSizedValue,
  isPropertyEditable,
} from "./utils";

import type {
  DragFinishedCallbackType,
  DragInputCallbackType,
} from "./drag-input.component";
import type { AtomicUnit } from "./utils";
import type { CaliburnEditorComponent } from "../../editor.component";

const STEP_SIZE = 10;

const getResizedUpdates = (
  anchorX: number,
  anchorY: number,
  scale: number,
  origElement: NonDeletedExcalidrawElement,
) => {
  const offsetX = origElement.x - anchorX;
  const offsetY = origElement.y - anchorY;
  const nextWidth = origElement.width * scale;
  const nextHeight = origElement.height * scale;
  const x = anchorX + offsetX * scale;
  const y = anchorY + offsetY * scale;

  return {
    width: nextWidth,
    height: nextHeight,
    x,
    y,
    ...rescalePointsInElement(origElement, nextWidth, nextHeight, false),
    ...(isTextElement(origElement)
      ? { fontSize: origElement.fontSize * scale }
      : {}),
  };
};

const resizeElementInGroup = (
  anchorX: number,
  anchorY: number,
  property: "width" | "height",
  scale: number,
  latestElement: NonDeletedExcalidrawElement,
  origElement: NonDeletedExcalidrawElement,
  originalElementsMap: ElementsMap,
  scene: Scene,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const updates = getResizedUpdates(anchorX, anchorY, scale, origElement);

  scene.mutateElement(latestElement, updates);

  const boundTextElement = getBoundTextElement(
    origElement,
    originalElementsMap,
  );
  if (boundTextElement) {
    const newFontSize = boundTextElement.fontSize * scale;
    updateBoundElements(latestElement, scene);
    const latestBoundTextElement = elementsMap.get(boundTextElement.id);
    if (latestBoundTextElement && isTextElement(latestBoundTextElement)) {
      scene.mutateElement(latestBoundTextElement, {
        fontSize: newFontSize,
      });
      handleBindTextResize(
        latestElement,
        scene,
        property === "width" ? "e" : "s",
        true,
      );
    }
  }
};

const resizeGroup = (
  nextWidth: number,
  nextHeight: number,
  initialHeight: number,
  aspectRatio: number,
  anchor: GlobalPoint,
  property: "width" | "height",
  latestElements: NonDeletedExcalidrawElement[],
  originalElements: NonDeletedExcalidrawElement[],
  originalElementsMap: ElementsMap,
  scene: Scene,
) => {
  // keep aspect ratio for groups
  if (property === "width") {
    nextHeight = Math.round((nextWidth / aspectRatio) * 100) / 100;
  } else {
    nextWidth = Math.round(nextHeight * aspectRatio * 100) / 100;
  }

  const scale = nextHeight / initialHeight;

  for (let i = 0; i < originalElements.length; i++) {
    const origElement = originalElements[i];
    const latestElement = latestElements[i];

    resizeElementInGroup(
      anchor[0],
      anchor[1],
      property,
      scale,
      latestElement,
      origElement,
      originalElementsMap,
      scene,
    );
  }
};

const handleDimensionChange: DragInputCallbackType<"width" | "height"> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  originalAppState,
  shouldChangeByStepSize,
  nextValue,
  scene,
  property,
  setAppState,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const atomicUnits = getAtomicUnits(originalElements, originalAppState);
  if (nextValue !== undefined) {
    for (const atomicUnit of atomicUnits) {
      const elementsInUnit = getElementsInAtomicUnit(
        atomicUnit,
        elementsMap,
        originalElementsMap,
      );

      if (elementsInUnit.length > 1) {
        const latestElements = elementsInUnit.map((el) => el.latest!);
        const originalElements = elementsInUnit.map((el) => el.original!);
        const [x1, y1, x2, y2] = getCommonBounds(originalElements);
        const initialWidth = x2 - x1;
        const initialHeight = y2 - y1;
        const aspectRatio = initialWidth / initialHeight;
        const nextWidth = Math.max(
          MIN_WIDTH_OR_HEIGHT,
          property === "width" ? Math.max(0, nextValue) : initialWidth,
        );
        const nextHeight = Math.max(
          MIN_WIDTH_OR_HEIGHT,
          property === "height" ? Math.max(0, nextValue) : initialHeight,
        );

        resizeGroup(
          nextWidth,
          nextHeight,
          initialHeight,
          aspectRatio,
          pointFrom(x1, y1),
          property,
          latestElements,
          originalElements,
          originalElementsMap,
          scene,
        );
      } else {
        const [el] = elementsInUnit;
        const latestElement = el?.latest;
        const origElement = el?.original;

        if (
          latestElement &&
          origElement &&
          isPropertyEditable(latestElement, property)
        ) {
          let nextWidth =
            property === "width" ? Math.max(0, nextValue) : latestElement.width;
          if (property === "width") {
            if (shouldChangeByStepSize) {
              nextWidth = getStepSizedValue(nextWidth, STEP_SIZE);
            } else {
              nextWidth = Math.round(nextWidth);
            }
          }

          let nextHeight =
            property === "height"
              ? Math.max(0, nextValue)
              : latestElement.height;
          if (property === "height") {
            if (shouldChangeByStepSize) {
              nextHeight = getStepSizedValue(nextHeight, STEP_SIZE);
            } else {
              nextHeight = Math.round(nextHeight);
            }
          }

          nextWidth = Math.max(MIN_WIDTH_OR_HEIGHT, nextWidth);
          nextHeight = Math.max(MIN_WIDTH_OR_HEIGHT, nextHeight);

          resizeSingleElement(
            nextWidth,
            nextHeight,
            latestElement,
            origElement,
            originalElementsMap,
            scene,
            property === "width" ? "e" : "s",
            {
              shouldInformMutation: false,
            },
          );

          // Handle frame membership update for resized frames
          if (isFrameLikeElement(latestElement)) {
            const nextElementsInFrame = getElementsInResizingFrame(
              scene.getElementsIncludingDeleted(),
              latestElement,
              originalAppState,
              scene.getNonDeletedElementsMap(),
            );

            const updatedElements = replaceAllElementsInFrame(
              scene.getElementsIncludingDeleted(),
              nextElementsInFrame,
              latestElement,
            );

            scene.replaceAllElements(updatedElements);
          }
        }
      }
    }

    scene.triggerUpdate();

    return;
  }

  const changeInWidth = property === "width" ? accumulatedChange : 0;
  const changeInHeight = property === "height" ? accumulatedChange : 0;
  const elementsToHighlight: NonDeletedExcalidrawElement[] = [];

  for (const atomicUnit of atomicUnits) {
    const elementsInUnit = getElementsInAtomicUnit(
      atomicUnit,
      elementsMap,
      originalElementsMap,
    );

    if (elementsInUnit.length > 1) {
      const latestElements = elementsInUnit.map((el) => el.latest!);
      const originalElements = elementsInUnit.map((el) => el.original!);

      const [x1, y1, x2, y2] = getCommonBounds(originalElements);
      const initialWidth = x2 - x1;
      const initialHeight = y2 - y1;
      const aspectRatio = initialWidth / initialHeight;
      let nextWidth = Math.max(0, initialWidth + changeInWidth);
      if (property === "width") {
        if (shouldChangeByStepSize) {
          nextWidth = getStepSizedValue(nextWidth, STEP_SIZE);
        } else {
          nextWidth = Math.round(nextWidth);
        }
      }

      let nextHeight = Math.max(0, initialHeight + changeInHeight);
      if (property === "height") {
        if (shouldChangeByStepSize) {
          nextHeight = getStepSizedValue(nextHeight, STEP_SIZE);
        } else {
          nextHeight = Math.round(nextHeight);
        }
      }

      nextWidth = Math.max(MIN_WIDTH_OR_HEIGHT, nextWidth);
      nextHeight = Math.max(MIN_WIDTH_OR_HEIGHT, nextHeight);

      resizeGroup(
        nextWidth,
        nextHeight,
        initialHeight,
        aspectRatio,
        pointFrom(x1, y1),
        property,
        latestElements,
        originalElements,
        originalElementsMap,
        scene,
      );
    } else {
      const [el] = elementsInUnit;
      const latestElement = el?.latest;
      const origElement = el?.original;

      if (
        latestElement &&
        origElement &&
        isPropertyEditable(latestElement, property)
      ) {
        let nextWidth = Math.max(0, origElement.width + changeInWidth);
        if (property === "width") {
          if (shouldChangeByStepSize) {
            nextWidth = getStepSizedValue(nextWidth, STEP_SIZE);
          } else {
            nextWidth = Math.round(nextWidth);
          }
        }

        let nextHeight = Math.max(0, origElement.height + changeInHeight);
        if (property === "height") {
          if (shouldChangeByStepSize) {
            nextHeight = getStepSizedValue(nextHeight, STEP_SIZE);
          } else {
            nextHeight = Math.round(nextHeight);
          }
        }

        nextWidth = Math.max(MIN_WIDTH_OR_HEIGHT, nextWidth);
        nextHeight = Math.max(MIN_WIDTH_OR_HEIGHT, nextHeight);

        resizeSingleElement(
          nextWidth,
          nextHeight,
          latestElement,
          origElement,
          originalElementsMap,
          scene,
          property === "width" ? "e" : "s",
          {
            shouldInformMutation: false,
          },
        );

        // Handle highlighting frame element candidates
        if (isFrameLikeElement(latestElement)) {
          const nextElementsInFrame = getNonDeletedElements(
            getElementsInResizingFrame(
              scene.getElementsIncludingDeleted(),
              latestElement,
              originalAppState,
              scene.getNonDeletedElementsMap(),
            ),
          );

          elementsToHighlight.push(...nextElementsInFrame);
        }
      }
    }
  }

  setAppState({
    elementsToHighlight,
  });

  scene.triggerUpdate();
};

const handleDragFinished: DragFinishedCallbackType = ({
  setAppState,
  app,
  originalElements,
  originalAppState,
}) => {
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const origElement = originalElements?.[0];
  const latestElement = origElement && elementsMap.get(origElement.id);

  // Handle frame membership update for resized frames
  if (latestElement && isFrameLikeElement(latestElement)) {
    const nextElementsInFrame = getElementsInResizingFrame(
      app.scene.getElementsIncludingDeleted(),
      latestElement,
      originalAppState,
      app.scene.getNonDeletedElementsMap(),
    );

    const updatedElements = replaceAllElementsInFrame(
      app.scene.getElementsIncludingDeleted(),
      nextElementsInFrame,
      latestElement,
    );

    app.scene.replaceAllElements(updatedElements);

    setAppState({
      elementsToHighlight: null,
    });
  }
};

/** Angular port of upstream `Stats/MultiDimension.tsx`. */
@Component({
  selector: "caliburn-stats-multi-dimension",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnStatsDragInputComponent],
  templateUrl: "./multi-dimension.component.html",
})
export class CaliburnStatsMultiDimensionComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly property = input.required<"width" | "height">();
  readonly elements = input.required<readonly NonDeletedExcalidrawElement[]>();
  readonly atomicUnits = input.required<AtomicUnit[]>();

  protected readonly handleDimensionChange = handleDimensionChange;
  protected readonly handleDragFinished = handleDragFinished;

  protected readonly label = computed(() =>
    this.property() === "width" ? "W" : "H",
  );

  private readonly sizes = computed(() => {
    this.editor.changeGeneration();
    const elementsMap = this.editor.scene.getNonDeletedElementsMap();
    const property = this.property();

    return this.atomicUnits().map((atomicUnit) => {
      const elementsInUnit = getElementsInAtomicUnit(atomicUnit, elementsMap);

      if (elementsInUnit.length > 1) {
        const [x1, y1, x2, y2] = getCommonBounds(
          elementsInUnit.map((el) => el.latest),
        );
        return (
          Math.round((property === "width" ? x2 - x1 : y2 - y1) * 100) / 100
        );
      }
      const [el] = elementsInUnit;

      return (
        Math.round(
          (property === "width" ? el.latest.width : el.latest.height) * 100,
        ) / 100
      );
    });
  });

  protected readonly value = computed<number | "Mixed">(() => {
    const sizes = this.sizes();
    return new Set(sizes).size === 1
      ? Math.round(sizes[0] * 100) / 100
      : "Mixed";
  });

  protected readonly editable = computed(() => this.sizes().length > 0);
}
