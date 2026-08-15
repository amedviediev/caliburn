import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { getCommonBounds, isTextElement } from "@excalidraw/element";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnStatsDragInputComponent } from "./drag-input.component";
import {
  getAtomicUnits,
  getElementsInAtomicUnit,
  getStepSizedValue,
  isPropertyEditable,
  moveElement,
  STEP_SIZE,
} from "./utils";

import type { Scene } from "@excalidraw/element";
import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import type { DragInputCallbackType } from "./drag-input.component";
import type { AtomicUnit } from "./utils";
import type { CaliburnEditorComponent } from "../../editor.component";

const moveElements = (
  property: "x" | "y",
  changeInTopX: number,
  changeInTopY: number,
  originalElements: readonly NonDeletedExcalidrawElement[],
  originalElementsMap: ElementsMap,
  scene: Scene,
  appState: AppState,
) => {
  for (let i = 0; i < originalElements.length; i++) {
    const origElement = originalElements[i];

    const [cx, cy] = [
      origElement.x + origElement.width / 2,
      origElement.y + origElement.height / 2,
    ];
    const [topLeftX, topLeftY] = pointRotateRads(
      pointFrom(origElement.x, origElement.y),
      pointFrom(cx, cy),
      origElement.angle,
    );

    const newTopLeftX =
      property === "x" ? Math.round(topLeftX + changeInTopX) : topLeftX;

    const newTopLeftY =
      property === "y" ? Math.round(topLeftY + changeInTopY) : topLeftY;

    moveElement(
      newTopLeftX,
      newTopLeftY,
      origElement,
      scene,
      appState,
      originalElementsMap,
      false,
    );
  }
};

const moveGroupTo = (
  nextX: number,
  nextY: number,
  originalElements: readonly NonDeletedExcalidrawElement[],
  originalElementsMap: ElementsMap,
  scene: Scene,
  appState: AppState,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const [x1, y1, ,] = getCommonBounds(originalElements);
  const offsetX = nextX - x1;
  const offsetY = nextY - y1;

  for (let i = 0; i < originalElements.length; i++) {
    const origElement = originalElements[i];

    const latestElement = elementsMap.get(origElement.id);
    if (!latestElement) {
      continue;
    }

    // bound texts are moved with their containers
    if (!isTextElement(latestElement) || !latestElement.containerId) {
      const [cx, cy] = [
        latestElement.x + latestElement.width / 2,
        latestElement.y + latestElement.height / 2,
      ];

      const [topLeftX, topLeftY] = pointRotateRads(
        pointFrom(latestElement.x, latestElement.y),
        pointFrom(cx, cy),
        latestElement.angle,
      );

      moveElement(
        topLeftX + offsetX,
        topLeftY + offsetY,
        origElement,
        scene,
        appState,
        originalElementsMap,
        false,
      );
    }
  }
};

const handlePositionChange: DragInputCallbackType<"x" | "y"> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  shouldChangeByStepSize,
  nextValue,
  property,
  scene,
  originalAppState,
  app,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();

  if (nextValue !== undefined) {
    for (const atomicUnit of getAtomicUnits(
      originalElements,
      originalAppState,
    )) {
      const elementsInUnit = getElementsInAtomicUnit(
        atomicUnit,
        elementsMap,
        originalElementsMap,
      );

      if (elementsInUnit.length > 1) {
        const [x1, y1, ,] = getCommonBounds(
          elementsInUnit.map((el) => el.latest!),
        );
        const newTopLeftX = property === "x" ? nextValue : x1;
        const newTopLeftY = property === "y" ? nextValue : y1;

        moveGroupTo(
          newTopLeftX,
          newTopLeftY,
          elementsInUnit.map((el) => el.original),
          originalElementsMap,
          scene,
          app.state,
        );
      } else {
        const origElement = elementsInUnit[0]?.original;
        const latestElement = elementsInUnit[0]?.latest;
        if (
          origElement &&
          latestElement &&
          isPropertyEditable(latestElement, property)
        ) {
          const [cx, cy] = [
            origElement.x + origElement.width / 2,
            origElement.y + origElement.height / 2,
          ];
          const [topLeftX, topLeftY] = pointRotateRads(
            pointFrom(origElement.x, origElement.y),
            pointFrom(cx, cy),
            origElement.angle,
          );

          const newTopLeftX = property === "x" ? nextValue : topLeftX;
          const newTopLeftY = property === "y" ? nextValue : topLeftY;
          moveElement(
            newTopLeftX,
            newTopLeftY,
            origElement,
            scene,
            app.state,
            originalElementsMap,
            false,
          );
        }
      }
    }

    scene.triggerUpdate();
    return;
  }

  const change = shouldChangeByStepSize
    ? getStepSizedValue(accumulatedChange, STEP_SIZE)
    : accumulatedChange;

  const changeInTopX = property === "x" ? change : 0;
  const changeInTopY = property === "y" ? change : 0;

  moveElements(
    property,
    changeInTopX,
    changeInTopY,
    originalElements,
    originalElementsMap,
    scene,
    app.state,
  );

  scene.triggerUpdate();
};

/** Angular port of upstream `Stats/MultiPosition.tsx`. */
@Component({
  selector: "caliburn-stats-multi-position",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnStatsDragInputComponent],
  templateUrl: "./multi-position.component.html",
})
export class CaliburnStatsMultiPositionComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly property = input.required<"x" | "y">();
  readonly elements = input.required<readonly NonDeletedExcalidrawElement[]>();
  readonly atomicUnits = input.required<AtomicUnit[]>();

  protected readonly handlePositionChange = handlePositionChange;

  protected readonly label = computed(() =>
    this.property() === "x" ? "X" : "Y",
  );

  protected readonly value = computed<number | "Mixed">(() => {
    this.editor.changeGeneration();
    const elementsMap = this.editor.scene.getNonDeletedElementsMap();
    const property = this.property();

    const positions = this.atomicUnits().map((atomicUnit) => {
      const elementsInUnit = Object.keys(atomicUnit)
        .map((id) => elementsMap.get(id))
        .filter((el) => el !== undefined) as ExcalidrawElement[];

      // we're dealing with a group
      if (elementsInUnit.length > 1) {
        const [x1, y1] = getCommonBounds(elementsInUnit);
        return Math.round((property === "x" ? x1 : y1) * 100) / 100;
      }

      const [el] = elementsInUnit;
      const [cx, cy] = [el.x + el.width / 2, el.y + el.height / 2];

      const [topLeftX, topLeftY] = pointRotateRads(
        pointFrom(el.x, el.y),
        pointFrom(cx, cy),
        el.angle,
      );

      return Math.round((property === "x" ? topLeftX : topLeftY) * 100) / 100;
    });

    return new Set(positions).size === 1 ? positions[0] : "Mixed";
  });
}
