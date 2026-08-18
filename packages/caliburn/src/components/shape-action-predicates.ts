import { isTransparent } from "@excalidraw/common";
import {
  hasBoundTextElement,
  hasStrokeColor,
  isElbowArrow,
  isImageElement,
  isLinearElement,
  isTextElement,
  shouldAllowVerticalAlign,
  suppportsHorizontalAlign,
  toolIsArrow,
} from "@excalidraw/element";
import {
  canChangeRoundness,
  canHaveArrowheads,
  getSelectedElements,
  hasBackground,
  hasFreedrawMode,
  hasStrokeStyle,
  hasStrokeWidth,
} from "@excalidraw/excalidraw/scene";

import type {
  ExcalidrawElement,
  ExcalidrawElementType,
  NonDeletedElementsMap,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";
import type {
  AppClassProperties,
  ElementOrToolType,
  UIAppState,
} from "@excalidraw/excalidraw/types";

import { alignActionsPredicate } from "../actions/actionAlign";

export const canChangeStrokeColor = (
  appState: UIAppState,
  targetElements: ExcalidrawElement[],
) => {
  let commonSelectedType: ExcalidrawElementType | null =
    targetElements[0]?.type || null;

  for (const element of targetElements) {
    if (element.type !== commonSelectedType) {
      commonSelectedType = null;
      break;
    }
  }

  return (
    (hasStrokeColor(appState.activeTool.type) &&
      commonSelectedType !== "image" &&
      commonSelectedType !== "frame" &&
      commonSelectedType !== "magicframe") ||
    targetElements.some((element) => hasStrokeColor(element.type))
  );
};

export const canChangeBackgroundColor = (
  appState: UIAppState,
  targetElements: ExcalidrawElement[],
) =>
  hasBackground(appState.activeTool.type) ||
  targetElements.some((element) => hasBackground(element.type));

/**
 * Framework-neutral mirror of upstream's shape-action visibility logic. The
 * upstream module imports React action panels only to obtain the align
 * predicate; Caliburn uses its local Angular action implementation instead.
 */
export const getShapeActionPredicates = (
  appState: UIAppState,
  targetElements: ExcalidrawElement[],
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap,
  app: AppClassProperties,
) => {
  const activeToolType = appState.activeTool.type;
  const forToolOrSelection = (
    predicate: (type: ElementOrToolType) => boolean,
  ) =>
    predicate(activeToolType) ||
    targetElements.some((element) => predicate(element.type));

  const singleSelected = targetElements.length === 1;
  const isSingleElementBoundContainer =
    targetElements.length === 2 &&
    (hasBoundTextElement(targetElements[0]) ||
      hasBoundTextElement(targetElements[1]));
  const isEditingTextOrNewElement = Boolean(
    appState.editingTextElement || appState.newElement,
  );
  const hasSelection = targetElements.length > 0;

  return {
    hasSelection,
    showExtraActions: hasSelection && !isEditingTextOrNewElement,
    strokeColor: canChangeStrokeColor(appState, targetElements),
    backgroundColor: canChangeBackgroundColor(appState, targetElements),
    fill:
      activeToolType === "bucketfill" ||
      (hasBackground(activeToolType) &&
        !isTransparent(appState.currentItemBackgroundColor)) ||
      targetElements.some(
        (element) =>
          hasBackground(element.type) &&
          !isTransparent(element.backgroundColor),
      ),
    strokeWidth: forToolOrSelection(hasStrokeWidth),
    freedrawMode: forToolOrSelection(hasFreedrawMode),
    strokeStyle: forToolOrSelection(hasStrokeStyle),
    sloppiness: forToolOrSelection(hasStrokeStyle),
    roundness: forToolOrSelection(canChangeRoundness),
    arrowType: forToolOrSelection(toolIsArrow),
    arrowheads: forToolOrSelection(canHaveArrowheads),
    text: activeToolType === "text" || targetElements.some(isTextElement),
    textAlign:
      activeToolType === "text" ||
      suppportsHorizontalAlign(targetElements, elementsMap),
    verticalAlign: shouldAllowVerticalAlign(targetElements, elementsMap),
    opacity: activeToolType !== "autoshape" || hasSelection,
    layers:
      (activeToolType !== "freedraw" &&
        activeToolType !== "autoshape" &&
        !targetElements.some((element) => element.type === "freedraw")) ||
      getSelectedElements(elementsMap, appState).some(
        (element) => element.type === "freedraw",
      ),
    align:
      !isSingleElementBoundContainer && alignActionsPredicate(appState, app),
    distribute: targetElements.length > 2,
    link: singleSelected || isSingleElementBoundContainer,
    linkSingleOnly: singleSelected,
    cropEditor:
      !appState.croppingElementId &&
      singleSelected &&
      isImageElement(targetElements[0]),
    lineEditor:
      !appState.selectedLinearElement?.isEditing &&
      singleSelected &&
      isLinearElement(targetElements[0]) &&
      !isElbowArrow(targetElements[0]),
  };
};

export type ShapeActionPredicates = ReturnType<typeof getShapeActionPredicates>;
