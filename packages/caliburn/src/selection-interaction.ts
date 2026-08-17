import {
  CURSOR_TYPE,
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
  getContainingFrame,
  getElementsInGroup,
  getElementsWithinSelection,
  getSelectedElements,
  hasBoundingBox,
  hitElementBoundingBox,
  hitElementBoundingBoxOnly,
  hitElementBoundText,
  hitElementItself,
  isCursorInFrame,
  isElbowArrow,
  isEmbeddableElement,
  isFrameLikeElement,
  isIframeLikeElement,
  isLinearElement,
  isNonDeletedElement,
  isSelectedViaGroup,
  isSomeElementSelected,
  isTextElement,
  makeNextSelectedElementIds,
  newElement,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawIframeLikeElement,
  NonDeleted,
  Ordered,
} from "@excalidraw/element/types";

import { actionToggleLinearEditor } from "./actions/actionLinearEditor";
import { originInGridFromEvent } from "./create-interaction";
import { finishImageCropping, maybeHandleCrop } from "./crop-interaction";
import { maybeDragSelectedElements } from "./drag-interaction";
import { getElementLinkAtPosition } from "./link-interaction";
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
    frameNameBound: isFrameLikeElement(element)
      ? editor.frameNameBoundsCache.get(element)
      : null,
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
  const iframeLikes: Ordered<NonDeleted<ExcalidrawIframeLikeElement>>[] = [];

  const elementsMap = editor.scene.getNonDeletedElementsMap();

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
  )
    .filter((el) => hitElement(editor, x, y, el))
    .filter((element) => {
      // hitting a frame's element from outside the frame is not considered a hit
      const containingFrame = getContainingFrame(element, elementsMap);
      if (containingFrame && !isNonDeletedElement(containingFrame)) {
        console.error("[NONDELETED][INVARIANT] Containing frame is deleted");
      }
      return containingFrame &&
        editor.state.frameRendering.enabled &&
        editor.state.frameRendering.clip &&
        // iframe-like elements are rendered as DOM overlays and are not
        // visually clipped by their containing frames
        !isIframeLikeElement(element)
        ? isCursorInFrame(
            { x, y },
            containingFrame as NonDeleted<ExcalidrawFrameLikeElement>,
            elementsMap,
          )
        : true;
    })
    .filter((el) => {
      // The parameter elements comes ordered from lower z-index to higher.
      // We want to preserve that order on the returned array.
      // Exception being embeddables which should be on top of everything else in
      // terms of hit testing.
      if (isIframeLikeElement(el)) {
        iframeLikes.push(el);
        return false;
      }
      return true;
    })
    .concat(iframeLikes) as NonDeleted<ExcalidrawElement>[];
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
      frameNameBound: isFrameLikeElement(elementWithHighestZIndex)
        ? editor.frameNameBoundsCache.get(elementWithHighestZIndex)
        : null,
    })
      ? elementWithHighestZIndex
      : allHitElements[allHitElements.length - 2];
  }
  if (allHitElements.length === 1) {
    return allHitElements[0];
  }

  return null;
};

/**
 * Returns `null` when the gesture must not start at all — upstream's
 * `handleSelectionOnPointerDown` returning `true` (the pointer hit an
 * element's link icon, or added a point to the linear element being edited).
 */
export const handleSelectionPointerDown = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
): PointerDownState | null => {
  const pointerDownState = initialPointerDownState(editor, event);
  const { origin } = pointerDownState;
  // upstream reads this off the pre-update state, which React only settles
  // once the handler returns
  const previousSelectedElementIds = editor.state.selectedElementIds;

  // upstream skips the hit/selection handling below when a transform handle is
  // armed, but still falls through to the selection-element creation
  if (maybeArmResizeOnPointerDown(editor, pointerDownState, event)) {
    createSelectionElementOnPointerDown(editor, pointerDownState);
    return pointerDownState;
  }

  if (editor.state.selectedLinearElement) {
    const ret = LinearElementEditor.handlePointerDown(
      event as any,
      editor as any,
      editor.store,
      pointerDownState.origin,
      editor.state.selectedLinearElement,
      editor.scene,
    );
    if (ret.hitElement) {
      pointerDownState.hit.element = ret.hitElement;
    }
    if (ret.linearElementEditor) {
      editor.setState({ selectedLinearElement: ret.linearElementEditor });
    }
    if (ret.didAddPoint) {
      return null;
    }
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
    // may already be set by the linear editor above, so check first
    hitElement =
      pointerDownState.hit.element ??
      getElementAtPosition(editor, origin.x, origin.y);
  }

  pointerDownState.hit.element = hitElement;

  editor.hitLinkElement = getElementLinkAtPosition(
    editor,
    origin,
    hitElementMightBeLocked,
  );

  if (editor.hitLinkElement) {
    return null;
  }

  if (
    editor.state.croppingElementId &&
    pointerDownState.hit.element?.id !== editor.state.croppingElementId
  ) {
    finishImageCropping(editor);
  }

  if (pointerDownState.hit.element) {
    // Early return if pointer is hitting link icon
    const hitLinkElement = getElementLinkAtPosition(
      editor,
      origin,
      pointerDownState.hit.element,
    );
    if (hitLinkElement) {
      return pointerDownState;
    }
  }

  pointerDownState.hit.allHitElements = unlockedHitElements;

  const someHitElementIsSelected = allHitElements.some(
    (element) => !!editor.state.selectedElementIds[element.id],
  );

  if (
    (hitElement === null || !someHitElementIsSelected) &&
    !event.shiftKey &&
    !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements &&
    (!editor.state.selectedLinearElement?.isEditing ||
      (hitElement &&
        hitElement?.id !== editor.state.selectedLinearElement?.elementId))
  ) {
    editor.clearSelection(hitElement);
  }

  if (editor.state.selectedLinearElement?.isEditing) {
    editor.setState((prevState) => ({
      selectedLinearElement: prevState.selectedLinearElement
        ? {
            ...prevState.selectedLinearElement,
            isEditing:
              !!hitElement &&
              hitElement.id === prevState.selectedLinearElement.elementId,
          }
        : null,
      selectedElementIds: prevState.selectedLinearElement
        ? makeNextSelectedElementIds(
            {
              [prevState.selectedLinearElement.elementId]: true,
            },
            prevState,
          )
        : makeNextSelectedElementIds({}, prevState),
    }));
  } else if (hitElement != null) {
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
        previousSelectedElementIds,
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
    previousSelectedElementIds,
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
  lastPointerCoords: { x: number; y: number },
) => {
  const coords = viewportCoordsToSceneCoords(event, editor.state);
  pointerDownState.lastCoords = coords;

  if (pointerDownState.resize.isResizing) {
    if (maybeHandleCrop(editor, pointerDownState, event)) {
      return;
    }
    if (maybeHandleResize(editor, pointerDownState, event)) {
      return;
    }
  }

  if (
    maybeDragSelectedElements(
      editor,
      pointerDownState,
      event,
      lastPointerCoords,
    )
  ) {
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
  pointerDownState: PointerDownState,
  event: PointerEvent,
) => {
  const hitElement = pointerDownState.hit.element;

  if (
    hitElement &&
    !pointerDownState.drag.hasOccurred &&
    !pointerDownState.hit.wasAddedToSelection &&
    // if we're editing a line, pointerup shouldn't switch selection if
    // box selected
    (!editor.state.selectedLinearElement?.isEditing ||
      !pointerDownState.boxSelection.hasOccurred) &&
    // hitElement can be set when alt + ctrl to toggle lasso and we will
    // just respect the selected elements from lasso instead
    editor.state.activeTool.type !== "lasso"
  ) {
    // when inside line editor, shift selects points instead
    if (event.shiftKey && !editor.state.selectedLinearElement?.isEditing) {
      if (editor.state.selectedElementIds[hitElement.id]) {
        if (isSelectedViaGroup(editor.state, hitElement)) {
          editor.setState((prevState) => {
            const nextSelectedElementIds = {
              ...prevState.selectedElementIds,
            };

            // We want to unselect all groups hitElement is part of
            // as well as all elements that are part of the groups
            // hitElement is part of
            for (const groupedElement of hitElement.groupIds.flatMap(
              (groupId) =>
                getElementsInGroup(
                  editor.scene.getNonDeletedElements(),
                  groupId,
                ),
            )) {
              delete nextSelectedElementIds[groupedElement.id];
            }

            return {
              selectedGroupIds: {
                ...prevState.selectedElementIds,
                ...hitElement.groupIds
                  .map((gId) => ({ [gId]: false }))
                  .reduce((prev, acc) => ({ ...prev, ...acc }), {}),
              },
              selectedElementIds: makeNextSelectedElementIds(
                nextSelectedElementIds,
                prevState,
              ),
            };
          });
          // if not dragging a linear element point (outside editor)
        } else if (!editor.state.selectedLinearElement?.isDragging) {
          // remove element from selection while
          // keeping prev elements selected
          editor.setState((prevState) => {
            const newSelectedElementIds = {
              ...prevState.selectedElementIds,
            };
            delete newSelectedElementIds[hitElement.id];
            const newSelectedElements = getSelectedElements(
              editor.scene.getNonDeletedElements(),
              { selectedElementIds: newSelectedElementIds },
            );

            return {
              ...selectGroupsForSelectedElements(
                {
                  editingGroupId: prevState.editingGroupId,
                  selectedElementIds: newSelectedElementIds,
                },
                editor.scene.getNonDeletedElements(),
                prevState,
                editor as any,
              ),
              // set selectedLinearElement only if thats the only element selected
              selectedLinearElement:
                newSelectedElements.length === 1 &&
                isLinearElement(newSelectedElements[0])
                  ? new LinearElementEditor(
                      newSelectedElements[0],
                      editor.scene.getNonDeletedElementsMap(),
                    )
                  : prevState.selectedLinearElement,
            };
          });
        }
      } else if (
        hitElement.frameId &&
        editor.state.selectedElementIds[hitElement.frameId]
      ) {
        // when hitElement is part of a selected frame, deselect the frame
        // to avoid frame and containing elements selected simultaneously
        editor.setState((prevState) => {
          const nextSelectedElementIds: {
            [id: string]: true;
          } = {
            ...prevState.selectedElementIds,
            [hitElement.id]: true,
          };
          // deselect the frame
          delete nextSelectedElementIds[hitElement.frameId!];

          // deselect groups containing the frame
          (editor.scene.getElement(hitElement.frameId!)?.groupIds ?? [])
            .flatMap((gid) =>
              getElementsInGroup(editor.scene.getNonDeletedElements(), gid),
            )
            .forEach((element) => {
              delete nextSelectedElementIds[element.id];
            });

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
            showHyperlinkPopup:
              hitElement.link || isEmbeddableElement(hitElement)
                ? "info"
                : false,
          };
        });
      } else {
        // add element to selection while keeping prev elements selected
        editor.setState((prevState) => ({
          selectedElementIds: makeNextSelectedElementIds(
            {
              ...prevState.selectedElementIds,
              [hitElement.id]: true,
            },
            prevState,
          ),
        }));
      }
    } else {
      editor.setState((prevState) => ({
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: prevState.editingGroupId,
            selectedElementIds: { [hitElement.id]: true },
          },
          editor.scene.getNonDeletedElements(),
          prevState,
          editor as any,
        ),
        selectedLinearElement:
          isLinearElement(hitElement) &&
          // Don't set `selectedLinearElement` if its same as the hitElement, this is mainly to prevent resetting the `hoverPointIndex` to -1.
          // Future we should update the API to take care of setting the correct `hoverPointIndex` when initialized
          prevState.selectedLinearElement?.elementId !== hitElement.id
            ? new LinearElementEditor(
                hitElement,
                editor.scene.getNonDeletedElementsMap(),
              )
            : prevState.selectedLinearElement,
      }));
    }
  }

  if (editor.state.selectionElement) {
    editor.setState({ selectionElement: null });
  }
};

/**
 * Upstream's deselect-on-pointer-up: a click that landed on a bounding box
 * without landing on anything drops the selection. It runs after the crop
 * exit, and returns from the pointer-up handler, so the caller must skip the
 * branches that follow it there.
 *
 * @returns true when the click deselected
 */
export const maybeDeselectOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
): boolean => {
  const hitElement = pointerDownState.hit.element;
  const elementsMap = editor.scene.getNonDeletedElementsMap();

  if (
    // do not clear selection if lasso is active
    editor.state.activeTool.type !== "lasso" &&
    // not elbow midpoint dragged
    !(hitElement && isElbowArrow(hitElement)) &&
    // not dragged
    !pointerDownState.drag.hasOccurred &&
    // not resized
    !editor.state.isResizing &&
    // only hitting the bounding box of the previous hit element
    ((hitElement &&
      hitElementBoundingBoxOnly(
        {
          point: pointFrom(
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ),
          element: hitElement,
          elementsMap,
          threshold: getElementHitThreshold(editor, hitElement),
          frameNameBound: isFrameLikeElement(hitElement)
            ? editor.frameNameBoundsCache.get(hitElement)
            : null,
        },
        elementsMap,
      )) ||
      (!hitElement &&
        pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements))
  ) {
    if (editor.state.selectedLinearElement?.isEditing) {
      // Exit editing mode but keep the element selected
      editor.actionManager.executeAction(actionToggleLinearEditor);
    } else {
      // Deselect selected elements
      editor.setState({
        selectedElementIds: makeNextSelectedElementIds({}, editor.state),
        selectedGroupIds: {},
        editingGroupId: null,
        activeEmbeddable: null,
      });
    }
    // reset cursor
    editor.cursor.set(CURSOR_TYPE.AUTO);
    return true;
  }

  return false;
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
