import {
  KEYS,
  getGridPoint,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  shouldRotateWithDiscreteAngle,
  tupleToCoors,
} from "@excalidraw/common";
import {
  getCommonBounds,
  getElementWithTransformHandleType,
  getResizeArrowDirection,
  getResizeOffsetXY,
  getSelectedElements,
  getTransformHandleTypeFromCoords,
  isElbowArrow,
  isFrameLikeElement,
  isImageElement,
  isLinearElement,
  transformElements,
} from "@excalidraw/element";
import { snapResizingElements } from "@excalidraw/excalidraw/snapping";

import type { MaybeTransformHandleType } from "@excalidraw/element";
import type { PointerType } from "@excalidraw/element/types";

import { getEffectiveGridSize } from "./create-interaction";
import { maybeCacheReferenceSnapPoints } from "./drag-interaction";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

export interface ResizePointerDownState {
  handleType: MaybeTransformHandleType;
  isResizing: boolean;
  offset: { x: number; y: number };
  arrowDirection: "origin" | "end";
  center: { x: number; y: number };
}

export const initialResizeState = (
  editor: CaliburnEditorComponent,
): ResizePointerDownState => {
  const selectedElements = editor.scene.getSelectedElements(editor.state);
  const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);
  return {
    handleType: false,
    isResizing: false,
    offset: { x: 0, y: 0 },
    arrowDirection: "origin",
    center: { x: (maxX + minX) / 2, y: (maxY + minY) / 2 },
  };
};

/**
 * Detects whether the pointer went down on a transform handle of the current
 * selection and arms the resize session if so. Returns true when armed.
 */
export const maybeArmResizeOnPointerDown = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): boolean => {
  const elements = editor.scene.getNonDeletedElements();
  const elementsMap = editor.scene.getNonDeletedElementsMap();
  const selectedElements = editor.scene.getSelectedElements(editor.state);

  if (
    selectedElements.length === 1 &&
    !editor.state.selectedLinearElement?.isEditing &&
    !isElbowArrow(selectedElements[0]) &&
    // HACK: upstream disables transform handles for linear elements on mobile
    // until a better way of showing them is found
    !(
      isLinearElement(selectedElements[0]) &&
      (editor.editorInterface.userAgent.isMobileDevice ||
        selectedElements[0].points.length === 2)
    ) &&
    // a hovered linear point wins over an edge resize handle, so the press
    // that follows the hover must not arm a resize instead of the point drag
    !(
      editor.state.selectedLinearElement &&
      editor.state.selectedLinearElement.hoverPointIndex !== -1
    )
  ) {
    const elementWithTransformHandleType = getElementWithTransformHandleType(
      elements,
      editor.state,
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      editor.state.zoom,
      event.pointerType as PointerType,
      elementsMap,
      editor.editorInterface,
    );
    if (elementWithTransformHandleType != null) {
      // upstream arms the handle without setting `resizingElement` while
      // cropping (rotation is the one handle type crop has no meaning for,
      // so it still goes through the normal resizingElement path)
      if (
        elementWithTransformHandleType.transformHandleType !== "rotation" &&
        editor.state.croppingElementId
      ) {
        pointerDownState.resize.handleType =
          elementWithTransformHandleType.transformHandleType;
      } else {
        editor.setState({
          resizingElement: elementWithTransformHandleType.element,
        });
        pointerDownState.resize.handleType =
          elementWithTransformHandleType.transformHandleType;
      }
    }
  } else if (selectedElements.length > 1) {
    pointerDownState.resize.handleType = getTransformHandleTypeFromCoords(
      getCommonBounds(selectedElements),
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      editor.state.zoom,
      event.pointerType as PointerType,
      editor.editorInterface,
    );
  }

  if (pointerDownState.resize.handleType) {
    pointerDownState.resize.isResizing = true;
    pointerDownState.resize.offset = tupleToCoors(
      getResizeOffsetXY(
        pointerDownState.resize.handleType,
        selectedElements,
        elementsMap,
        pointerDownState.origin.x,
        pointerDownState.origin.y,
      ),
    );
    if (
      selectedElements.length === 1 &&
      isLinearElement(selectedElements[0]) &&
      selectedElements[0].points.length === 2
    ) {
      pointerDownState.resize.arrowDirection = getResizeArrowDirection(
        pointerDownState.resize.handleType,
        selectedElements[0],
      );
    }
    return true;
  }
  return false;
};

export const maybeHandleResize = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent | KeyboardEvent,
): boolean => {
  const selectedElements = editor.scene.getSelectedElements(editor.state);
  const selectedFrames = selectedElements.filter(isFrameLikeElement);

  const transformHandleType = pointerDownState.resize.handleType;

  if (
    // Frames cannot be rotated.
    (selectedFrames.length > 0 && transformHandleType === "rotation") ||
    // Elbow arrows cannot be transformed (resized or rotated).
    (selectedElements.length === 1 && isElbowArrow(selectedElements[0])) ||
    // Do not resize when in crop mode
    editor.state.croppingElementId
  ) {
    return false;
  }

  editor.setState({
    isResizing: transformHandleType && transformHandleType !== "rotation",
    isRotating: transformHandleType === "rotation",
    activeEmbeddable: null,
  });
  const pointerCoords = pointerDownState.lastCoords;
  let [resizeX, resizeY] = getGridPoint(
    pointerCoords.x - pointerDownState.resize.offset.x,
    pointerCoords.y - pointerDownState.resize.offset.y,
    event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
  );

  // check needed for avoiding flickering when a key gets pressed
  // during dragging
  if (!editor.state.selectedElementsAreBeingDragged) {
    const [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
    );

    const dragOffset = {
      x: gridX - pointerDownState.originInGrid.x,
      y: gridY - pointerDownState.originInGrid.y,
    };

    const originalElements = [...pointerDownState.originalElements.values()];

    maybeCacheReferenceSnapPoints(editor, event, selectedElements);

    const { snapOffset, snapLines } = snapResizingElements(
      selectedElements,
      getSelectedElements(originalElements, editor.state),
      editor as any,
      event,
      dragOffset,
      transformHandleType,
    );

    resizeX += snapOffset.x;
    resizeY += snapOffset.y;

    editor.setState({
      snapLines,
    });
  }

  if (
    transformElements(
      pointerDownState.originalElements,
      transformHandleType,
      selectedElements,
      editor.scene,
      shouldRotateWithDiscreteAngle(event),
      shouldResizeFromCenter(event),
      selectedElements.some((element) => isImageElement(element))
        ? !shouldMaintainAspectRatio(event)
        : shouldMaintainAspectRatio(event),
      resizeX,
      resizeY,
      pointerDownState.resize.center.x,
      pointerDownState.resize.center.y,
    )
  ) {
    return true;
  }
  return false;
};
