import {
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  KEYS,
  distance,
  getStrokeWidthByKey,
  shouldMaintainAspectRatio,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  LinearElementEditor,
  deepCopyElement,
  dragNewElement,
  editGroupForSelectedElement,
  getCommonBounds,
  getElementsWithinSelection,
  hasBoundingBox,
  hitElementBoundingBox,
  hitElementBoundText,
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
import { isEditingTextContent } from "./text-interaction";
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

export const getElementHitThreshold = (
  editor: CaliburnEditorComponent,
  element: ExcalidrawElement,
) => {
  return Math.max(
    element.strokeWidth / 2 + 0.1,
    // NOTE: Here be dragons. Do not go under the 0.63 multiplier unless you're
    // willing to test extensively. The hit testing starts to become unreliable
    // due to FP imprecision under 0.63 in high zoom levels.
    0.85 * (DEFAULT_COLLISION_THRESHOLD / editor.state.zoom.value),
  );
};

const hitElement = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
  element: NonDeleted<ExcalidrawElement>,
  considerBoundingBox = true,
) => {
  // if the element is selected, then hit test is done against its bounding box
  if (
    considerBoundingBox &&
    editor.state.selectedElementIds[element.id] &&
    hasBoundingBox([element], editor.state, editor.editorInterface)
  ) {
    // if hitting the bounding box, return early
    // but if not, we should check for other cases as well (e.g. frame name)
    if (
      hitElementBoundingBox(
        pointFrom(x, y),
        element,
        editor.scene.getNonDeletedElementsMap(),
        getElementHitThreshold(editor, element),
      )
    ) {
      return true;
    }
  }

  // take bound text element into consideration for hit collision as well
  const hitBoundTextOfElement = hitElementBoundText(
    pointFrom(x, y),
    element,
    editor.scene.getNonDeletedElementsMap(),
  );
  if (hitBoundTextOfElement) {
    return true;
  }

  return hitElementItself({
    point: pointFrom(x, y),
    element,
    threshold: getElementHitThreshold(editor, element),
    elementsMap: editor.scene.getNonDeletedElementsMap(),
  });
};

export const getElementsAtPosition = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
  opts?: {
    includeBoundTextElement?: boolean;
    includeLockedElements?: boolean;
  },
): NonDeleted<ExcalidrawElement>[] => {
  return (
    opts?.includeBoundTextElement && opts?.includeLockedElements
      ? editor.scene.getNonDeletedElements()
      : editor.scene
          .getNonDeletedElements()
          .filter(
            (element) =>
              (opts?.includeLockedElements || !element.locked) &&
              (opts?.includeBoundTextElement ||
                !(isTextElement(element) && element.containerId)),
          )
  ).filter((el) => hitElement(editor, x, y, el));
};

export const getElementAtPosition = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
  opts?:
    | {
        includeBoundTextElement?: boolean;
        includeLockedElements?: boolean;
        preferSelected?: boolean;
      }
    | {
        allHitElements: NonDeleted<ExcalidrawElement>[];
        preferSelected?: boolean;
      },
): NonDeleted<ExcalidrawElement> | null => {
  let allHitElements: NonDeleted<ExcalidrawElement>[];
  if (opts && "allHitElements" in opts) {
    allHitElements = opts?.allHitElements || [];
  } else {
    allHitElements = getElementsAtPosition(editor, x, y, {
      includeBoundTextElement: opts?.includeBoundTextElement,
      includeLockedElements: opts?.includeLockedElements,
    });
  }

  if (allHitElements.length > 1) {
    if (opts?.preferSelected) {
      for (let index = allHitElements.length - 1; index > -1; index--) {
        if (editor.state.selectedElementIds[allHitElements[index].id]) {
          return allHitElements[index];
        }
      }
    }
    const elementWithHighestZIndex = allHitElements[allHitElements.length - 1];

    // If we're hitting element with highest z-index only on its bounding box
    // while also hitting other element figure, the latter should be considered.
    return hitElementItself({
      point: pointFrom(x, y),
      element: elementWithHighestZIndex,
      // when overlapping, we would like to be more precise
      // this also avoids the need to update past tests
      threshold: getElementHitThreshold(editor, elementWithHighestZIndex) / 2,
      elementsMap: editor.scene.getNonDeletedElementsMap(),
    })
      ? elementWithHighestZIndex
      : allHitElements[allHitElements.length - 2];
  }
  if (allHitElements.length === 1) {
    return allHitElements[0];
  }

  return null;
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

  const allHitElements = getElementsAtPosition(editor, origin.x, origin.y, {
    includeLockedElements: true,
  });
  const unlockedHitElements = allHitElements.filter((e) => !e.locked);

  // Cannot set preferSelected in getElementAtPosition as we do in pointer move; consider:
  // A & B: both unlocked, A selected, B on top, A & B overlaps in some way
  // we want to select B when clicking on the overlapping area
  const hitElementMightBeLocked = getElementAtPosition(
    editor,
    origin.x,
    origin.y,
    {
      allHitElements,
    },
  );

  if (
    !hitElementMightBeLocked ||
    hitElementMightBeLocked.id !== editor.state.activeLockedId
  ) {
    editor.setState({
      activeLockedId: null,
    });
  }

  let hitElement: NonDeleted<ExcalidrawElement> | null;
  if (
    hitElementMightBeLocked &&
    hitElementMightBeLocked.locked &&
    !unlockedHitElements.some((el) => editor.state.selectedElementIds[el.id])
  ) {
    hitElement = null;
  } else {
    hitElement = getElementAtPosition(editor, origin.x, origin.y);
  }

  pointerDownState.hit.element = hitElement;
  pointerDownState.hit.allHitElements = unlockedHitElements;

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
    // == deep selection ==
    // on CMD/CTRL, drill down to hit element regardless of groups etc.
    if (event[KEYS.CTRL_OR_CMD]) {
      if (event.altKey) {
        // ctrl + alt means we're lasso selecting - start lasso trail and
        // switch to lasso tool
        editor.lassoTrail.startPath(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          event.shiftKey,
        );
        editor.setActiveTool({ type: "lasso", fromSelection: true });
        return pointerDownState;
      }
      if (!editor.state.selectedElementIds[hitElement.id]) {
        pointerDownState.hit.wasAddedToSelection = true;
      }
      editor.setState((prevState) => ({
        ...editGroupForSelectedElement(prevState, hitElement),
        previousSelectedElementIds: editor.state.selectedElementIds,
      }));
      // the fall-through below creates the selection element so a
      // cmd/ctrl-drag can marquee-select within the hit element
    } else if (
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
  }

  editor.setState({
    previousSelectedElementIds: editor.state.selectedElementIds,
  });

  if (editor.state.activeTool.type !== "lasso") {
    createSelectionElementOnPointerDown(editor, pointerDownState);
  }

  return pointerDownState;
};

export const handleLassoPointerDown = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
  pointerDownState: PointerDownState,
) => {
  const hitSelectedElement =
    pointerDownState.hit.element &&
    !!editor.state.selectedElementIds[pointerDownState.hit.element.id];
  const shouldForceLassoReselect =
    event.altKey &&
    event[KEYS.CTRL_OR_CMD] &&
    !pointerDownState.resize.handleType;
  const shouldStartLassoSelection =
    shouldForceLassoReselect ||
    (!pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements &&
      !pointerDownState.resize.handleType &&
      !hitSelectedElement);

  if (shouldStartLassoSelection) {
    if (!editor.lassoTrail.hasCurrentTrail) {
      editor.lassoTrail.startPath(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        event.shiftKey,
      );
    }

    // block dragging after lasso selection on PCs until the next pointer down
    // (on mobile or tablet, we want to allow user to drag immediately)
    pointerDownState.drag.blockDragging =
      editor.editorInterface.formFactor === "desktop";
  }
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

  if (maybeDragSelectedElements(editor, pointerDownState, event)) {
    return;
  }

  if (editor.state.selectionElement) {
    if (event.altKey) {
      editor.setActiveTool(
        { type: "lasso", fromSelection: true },
        { keepSelection: event.shiftKey },
      );
      editor.lassoTrail.startPath(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        event.shiftKey,
      );
      editor.setState({
        selectionElement: null,
      });
      return;
    }
    pointerDownState.boxSelection.hasOccurred = true;
    maybeDragNewGenericElement(editor, pointerDownState, event);
    updateBoxSelection(editor, pointerDownState, event);
  } else if (editor.state.activeTool.type === "lasso") {
    if (!event.altKey && editor.state.activeTool.fromSelection) {
      editor.setActiveTool({ type: "selection" });
      createSelectionElementOnPointerDown(editor, pointerDownState);
      pointerDownState.boxSelection.hasOccurred = true;
      maybeDragNewGenericElement(editor, pointerDownState, event);
      editor.lassoTrail.endPath();
    } else {
      editor.lassoTrail.addPointToPath(
        pointerDownState.lastCoords.x,
        pointerDownState.lastCoords.y,
        event.shiftKey,
      );
    }
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

export const updateActiveLockedIdOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
) => {
  // if current elements are still selected
  // and the pointer is just over a locked element
  // do not allow activeLockedId to be set

  const hitElements = pointerDownState.hit.allHitElements;

  const sceneCoords = viewportCoordsToSceneCoords(
    { clientX: event.clientX, clientY: event.clientY },
    editor.state,
  );

  if (
    editor.state.activeTool.type === "selection" &&
    !pointerDownState.boxSelection.hasOccurred &&
    !pointerDownState.resize.isResizing &&
    !hitElements.some((el) => editor.state.selectedElementIds[el.id])
  ) {
    const hitLockedElement = getElementAtPosition(
      editor,
      sceneCoords.x,
      sceneCoords.y,
      {
        includeLockedElements: true,
      },
    );

    if (!isEditingTextContent(editor)) {
      editor.store.scheduleCapture();
    }

    if (hitLockedElement?.locked) {
      editor.setState({
        activeLockedId:
          hitLockedElement.groupIds.length > 0
            ? hitLockedElement.groupIds.at(-1) || ""
            : hitLockedElement.id,
      });
    } else {
      editor.setState({
        activeLockedId: null,
      });
    }
  } else {
    editor.setState({
      activeLockedId: null,
    });
  }
};
