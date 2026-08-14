import {
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  distance,
  getStrokeWidthByKey,
  shouldMaintainAspectRatio,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  LinearElementEditor,
  deepCopyElement,
  dragNewElement,
  getCommonBounds,
  getElementsWithinSelection,
  hitElementItself,
  isLinearElement,
  isSomeElementSelected,
  isTextElement,
  newElement,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { ExcalidrawElement, NonDeleted } from "@excalidraw/element/types";

import { originInGridFromEvent } from "./create-interaction";
import { maybeDragSelectedElements } from "./drag-interaction";
import {
  initialResizeState,
  maybeArmResizeOnPointerDown,
  maybeHandleResize,
} from "./resize-interaction";

import type { ResizePointerDownState } from "./resize-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

export interface PointerDownState {
  origin: { x: number; y: number };
  originInGrid: { x: number; y: number };
  lastCoords: { x: number; y: number };
  originalElements: Map<string, NonDeleted<ExcalidrawElement>>;
  hit: {
    element: NonDeleted<ExcalidrawElement> | null;
    allHitElements: NonDeleted<ExcalidrawElement>[];
    wasAddedToSelection: boolean;
    hasBeenDuplicated: boolean;
    hasHitCommonBoundingBoxOfSelectedElements: boolean;
  };
  boxSelection: { hasOccurred: boolean };
  resize: ResizePointerDownState;
  drag: {
    hasOccurred: boolean;
    offset: { x: number; y: number } | null;
    origin: { x: number; y: number };
    blockDragging: boolean;
  };
  withCmdOrCtrl: boolean;
}

export const isHittingCommonBoundingBoxOfSelectedElements = (
  editor: CaliburnEditorComponent,
  point: Readonly<{ x: number; y: number }>,
  selectedElements: readonly ExcalidrawElement[],
): boolean => {
  if (selectedElements.length < 2) {
    return false;
  }

  // How many pixels off the shape boundary we still consider a hit
  const threshold = Math.max(
    DEFAULT_COLLISION_THRESHOLD / editor.state.zoom.value,
    1,
  );
  const boundsPadding =
    (DEFAULT_TRANSFORM_HANDLE_SPACING * 2) / editor.state.zoom.value;
  const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
  return (
    point.x > x1 - boundsPadding - threshold &&
    point.x < x2 + boundsPadding + threshold &&
    point.y > y1 - boundsPadding - threshold &&
    point.y < y2 + boundsPadding + threshold
  );
};

export const initialPointerDownState = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
): PointerDownState => {
  const origin = viewportCoordsToSceneCoords(event, editor.state);
  const selectedElements = editor.scene.getSelectedElements(editor.state);
  return {
    origin,
    originInGrid: originInGridFromEvent(editor, event),
    lastCoords: { ...origin },
    originalElements: editor.scene
      .getNonDeletedElements()
      .reduce((acc, element) => {
        acc.set(element.id, deepCopyElement(element));
        return acc;
      }, new Map<string, NonDeleted<ExcalidrawElement>>()),
    hit: {
      element: null,
      allHitElements: [],
      wasAddedToSelection: false,
      hasBeenDuplicated: false,
      hasHitCommonBoundingBoxOfSelectedElements:
        isHittingCommonBoundingBoxOfSelectedElements(
          editor,
          origin,
          selectedElements,
        ),
    },
    boxSelection: { hasOccurred: false },
    resize: initialResizeState(editor),
    drag: {
      hasOccurred: false,
      offset: null,
      origin: { ...origin },
      blockDragging: false,
    },
    withCmdOrCtrl: event.metaKey || event.ctrlKey,
  };
};

const getElementHitThreshold = (
  editor: CaliburnEditorComponent,
  element: ExcalidrawElement,
) => {
  return Math.max(
    element.strokeWidth / 2 + 0.1,
    0.85 * (DEFAULT_COLLISION_THRESHOLD / editor.state.zoom.value),
  );
};

export const getElementsAtPosition = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
): NonDeleted<ExcalidrawElement>[] => {
  const elementsMap = editor.scene.getNonDeletedElementsMap();
  return editor.scene
    .getNonDeletedElements()
    .filter(
      (element) =>
        !element.locked && !(isTextElement(element) && element.containerId),
    )
    .filter((element) =>
      hitElementItself({
        point: pointFrom(x, y),
        element,
        threshold: getElementHitThreshold(editor, element),
        elementsMap,
      }),
    );
};

export const getElementAtPosition = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
): NonDeleted<ExcalidrawElement> | null => {
  const candidates = getElementsAtPosition(editor, x, y);

  // topmost element wins
  return candidates.length ? candidates[candidates.length - 1] : null;
};

export const handleSelectionPointerDown = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
): PointerDownState => {
  const pointerDownState = initialPointerDownState(editor, event);
  const { origin } = pointerDownState;

  if (maybeArmResizeOnPointerDown(editor, pointerDownState, event)) {
    return pointerDownState;
  }

  const allHitElements = getElementsAtPosition(editor, origin.x, origin.y);
  const hitElement = allHitElements.length
    ? allHitElements[allHitElements.length - 1]
    : null;
  pointerDownState.hit.element = hitElement;
  pointerDownState.hit.allHitElements = allHitElements;

  const someHitElementIsSelected = allHitElements.some(
    (element) => !!editor.state.selectedElementIds[element.id],
  );

  if (
    (hitElement === null || !someHitElementIsSelected) &&
    !event.shiftKey &&
    !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
  ) {
    editor.clearSelection(hitElement);
  }

  if (hitElement != null) {
    if (
      !editor.state.selectedElementIds[hitElement.id] &&
      !someHitElementIsSelected &&
      !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
    ) {
      pointerDownState.hit.wasAddedToSelection = true;
      editor.setState((prevState) => ({
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: prevState.editingGroupId,
            selectedElementIds: {
              ...prevState.selectedElementIds,
              [hitElement.id]: true,
            },
          },
          editor.scene.getNonDeletedElements(),
          prevState,
          editor as any,
        ),
      }));
    }
  } else if (!pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements) {
    createSelectionElementOnPointerDown(editor, pointerDownState);
  }

  return pointerDownState;
};

const createSelectionElementOnPointerDown = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
) => {
  const element = newElement({
    type: "selection",
    x: pointerDownState.origin.x,
    y: pointerDownState.origin.y,
    strokeColor: editor.state.currentItemStrokeColor,
    backgroundColor: editor.state.currentItemBackgroundColor,
    fillStyle: editor.state.currentItemFillStyle,
    strokeWidth: getStrokeWidthByKey(
      "selection",
      editor.state.currentItemStrokeWidthKey,
    ),
    strokeStyle: editor.state.currentItemStrokeStyle,
    roughness: editor.state.currentItemRoughness,
    opacity: editor.state.currentItemOpacity,
    roundness: null,
    locked: false,
    frameId: null,
  });

  editor.setState({ selectionElement: element });
};

export const handleSelectionPointerMove = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
) => {
  const coords = viewportCoordsToSceneCoords(event, editor.state);
  pointerDownState.lastCoords = coords;

  if (pointerDownState.resize.isResizing) {
    if (maybeHandleResize(editor, pointerDownState, event)) {
      return;
    }
  }

  if (editor.state.selectionElement) {
    pointerDownState.boxSelection.hasOccurred = true;
    maybeDragNewGenericElement(editor, pointerDownState, event);
    updateBoxSelection(editor, pointerDownState, event);
  } else {
    maybeDragSelectedElements(editor, pointerDownState, event);
  }
};

const maybeDragNewGenericElement = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
) => {
  const selectionElement = editor.state.selectionElement;
  const pointerCoords = pointerDownState.lastCoords;
  if (selectionElement && pointerDownState.boxSelection.hasOccurred) {
    dragNewElement({
      newElement: selectionElement,
      elementType: editor.state.activeTool.type,
      originX: pointerDownState.origin.x,
      originY: pointerDownState.origin.y,
      x: pointerCoords.x,
      y: pointerCoords.y,
      width: distance(pointerDownState.origin.x, pointerCoords.x),
      height: distance(pointerDownState.origin.y, pointerCoords.y),
      shouldMaintainAspectRatio: shouldMaintainAspectRatio(event),
      shouldResizeFromCenter: false,
      scene: editor.scene,
      zoom: editor.state.zoom.value,
      informMutation: false,
    });
  }
};

const updateBoxSelection = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
) => {
  const elements = editor.scene.getNonDeletedElements();

  let shouldReuseSelection = true;

  if (!event.shiftKey && isSomeElementSelected(elements, editor.state)) {
    if (pointerDownState.withCmdOrCtrl && pointerDownState.hit.element) {
      editor.setState((prevState) =>
        selectGroupsForSelectedElements(
          {
            ...prevState,
            selectedElementIds: {
              [pointerDownState.hit.element!.id]: true,
            },
          },
          editor.scene.getNonDeletedElements(),
          prevState,
          editor as any,
        ),
      );
    } else {
      shouldReuseSelection = false;
    }
  }
  const elementsWithinSelection = editor.state.selectionElement
    ? getElementsWithinSelection(
        elements,
        editor.state.selectionElement,
        editor.scene.getNonDeletedElementsMap(),
        false,
        editor.state.boxSelectionMode,
      )
    : [];

  editor.setState((prevState) => {
    const nextSelectedElementIds: Record<ExcalidrawElement["id"], true> = {
      ...(shouldReuseSelection && prevState.selectedElementIds),
      ...elementsWithinSelection.reduce(
        (acc: Record<ExcalidrawElement["id"], true>, element) => {
          acc[element.id] = true;
          return acc;
        },
        {},
      ),
    };

    if (pointerDownState.hit.element) {
      // if using ctrl/cmd, select the hitElement only if we
      // haven't box-selected anything else
      if (!elementsWithinSelection.length) {
        nextSelectedElementIds[pointerDownState.hit.element.id] = true;
      } else {
        delete nextSelectedElementIds[pointerDownState.hit.element.id];
      }
    }

    prevState = !shouldReuseSelection
      ? { ...prevState, selectedGroupIds: {}, editingGroupId: null }
      : prevState;

    return {
      ...selectGroupsForSelectedElements(
        {
          editingGroupId: prevState.editingGroupId,
          selectedElementIds: nextSelectedElementIds,
        },
        editor.scene.getNonDeletedElements(),
        prevState,
        editor as any,
      ),
      // select linear element only when we haven't box-selected anything else
      selectedLinearElement:
        elementsWithinSelection.length === 1 &&
        isLinearElement(elementsWithinSelection[0])
          ? new LinearElementEditor(
              elementsWithinSelection[0],
              editor.scene.getNonDeletedElementsMap(),
            )
          : prevState.selectedLinearElement,
    };
  });
};

export const handleSelectionPointerUp = (
  editor: CaliburnEditorComponent,
  _pointerDownState: PointerDownState,
) => {
  if (editor.state.selectionElement) {
    editor.setState({ selectionElement: null });
  }
};
