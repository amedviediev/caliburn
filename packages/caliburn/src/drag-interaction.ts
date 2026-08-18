import {
  KEYS,
  TOOL_TYPE,
  arrayToMap,
  isShallowEqual,
  randomInteger,
  tupleToCoors,
  updateActiveTool,
  updateStable,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  deepCopyElement,
  dragSelectedElements,
  duplicateElements,
  getDragOffsetXY,
  getSelectionStateForElements,
  isBindableElement,
  isElbowArrow,
  isSomeElementSelected,
  newElementWith,
  syncMovedIndices,
  updateBoundElements,
} from "@excalidraw/element";
import {
  SnapCache,
  getReferenceSnapPoints,
  getVisibleGaps,
  isSnappingEnabled,
  snapDraggedElements,
} from "@excalidraw/excalidraw/snapping";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";
import type { KeyboardModifiersObject } from "@excalidraw/excalidraw/types";

import { getEffectiveGridSize } from "./create-interaction";
import { maybeMoveCropRegion } from "./crop-interaction";
import { maybeUpdateFrameToHighlightOnDrag } from "./frame-interaction";
import { isEditingTextContent } from "./text-interaction";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

const maybeCacheVisibleGaps = (
  editor: CaliburnEditorComponent,
  event: KeyboardModifiersObject,
  selectedElements: readonly NonDeletedExcalidrawElement[],
  recomputeAnyways: boolean = false,
) => {
  if (
    isSnappingEnabled({
      event,
      app: editor as any,
      selectedElements,
    }) &&
    (recomputeAnyways || !SnapCache.getVisibleGaps())
  ) {
    SnapCache.setVisibleGaps(
      getVisibleGaps(
        editor.scene.getNonDeletedElements(),
        selectedElements,
        editor.state,
        editor.scene.getNonDeletedElementsMap(),
      ),
    );
  }
};

export const maybeCacheReferenceSnapPoints = (
  editor: CaliburnEditorComponent,
  event: KeyboardModifiersObject,
  selectedElements: readonly NonDeletedExcalidrawElement[],
) => {
  if (
    isSnappingEnabled({
      event,
      app: editor as any,
      selectedElements,
    }) &&
    !SnapCache.getReferenceSnapPoints()
  ) {
    SnapCache.setReferenceSnapPoints(
      getReferenceSnapPoints(
        editor.scene.getNonDeletedElements(),
        selectedElements,
        editor.state,
        editor.scene.getNonDeletedElementsMap(),
      ),
    );
  }
};

export const maybeDragSelectedElements = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
  lastPointerCoords: { x: number; y: number },
): boolean => {
  const pointerCoords = pointerDownState.lastCoords;

  // We need to initialize dragOffsetXY only after we've updated
  // `state.selectedElementIds` on pointerDown. Doing it here in pointerMove
  // event handler should hopefully ensure we're already working with
  // the updated state.
  if (pointerDownState.drag.offset === null) {
    pointerDownState.drag.offset = tupleToCoors(
      getDragOffsetXY(
        editor.scene.getSelectedElements(editor.state),
        pointerDownState.origin.x,
        pointerDownState.origin.y,
      ),
    );
  }

  const hasHitASelectedElement = pointerDownState.hit.allHitElements.some(
    (element) => !!editor.state.selectedElementIds[element.id],
  );

  if (
    !(
      hasHitASelectedElement ||
      pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
    ) ||
    pointerDownState.drag.blockDragging
  ) {
    return false;
  }

  const selectedElements = editor.scene.getSelectedElements(editor.state);
  if (
    selectedElements.length > 0 &&
    selectedElements.every((element) => element.locked)
  ) {
    return true;
  }

  maybeUpdateFrameToHighlightOnDrag(editor, pointerCoords);

  // Marking that click was used for dragging to check
  // if elements should be deselected on pointerup
  pointerDownState.drag.hasOccurred = true;

  // prevent dragging even if we're no longer holding cmd/ctrl otherwise
  // it would have weird results (stuff jumping all over the screen)
  // Checking for editingTextElement to avoid jump while editing on mobile #6503
  // (with cmd/ctrl held the pointer falls through to the marquee instead)
  if (
    selectedElements.length === 0 ||
    pointerDownState.withCmdOrCtrl ||
    editor.state.editingTextElement ||
    editor.state.activeEmbeddable?.state === "active"
  ) {
    return false;
  }
  {
    const dragOffset = {
      x: pointerCoords.x - pointerDownState.drag.origin.x,
      y: pointerCoords.y - pointerDownState.drag.origin.y,
    };

    const originalElements = [...pointerDownState.originalElements.values()];

    // We only drag in one direction if shift is pressed
    const lockDirection = event.shiftKey;

    if (lockDirection) {
      const distanceX = Math.abs(dragOffset.x);
      const distanceY = Math.abs(dragOffset.y);

      const lockX = lockDirection && distanceX < distanceY;
      const lockY = lockDirection && distanceX > distanceY;

      if (lockX) {
        dragOffset.x = 0;
      }

      if (lockY) {
        dragOffset.y = 0;
      }
    }

    // #region move crop region
    if (maybeMoveCropRegion(editor, pointerDownState, lastPointerCoords)) {
      return true;
    }

    // Snap cache *must* be synchronously popuplated before initial drag,
    // otherwise the first drag even will not snap, causing a jump before
    // it snaps to its position if previously snapped already.
    maybeCacheVisibleGaps(editor, event, selectedElements);
    maybeCacheReferenceSnapPoints(editor, event, selectedElements);

    const { snapOffset, snapLines } = snapDraggedElements(
      originalElements,
      dragOffset,
      editor as any,
      event,
      editor.scene.getNonDeletedElementsMap(),
    );

    editor.setState({ snapLines });

    dragSelectedElements(
      pointerDownState as any,
      selectedElements,
      dragOffset,
      editor.scene,
      snapOffset,
      event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
    );

    editor.setState({
      selectedElementsAreBeingDragged: true,
      // element is being dragged and selectionElement that was created on pointer down
      // should be removed
      selectionElement: null,
    });

    // We duplicate the selected element if alt is pressed on pointer move
    if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
      // Move the currently selected elements to the top of the z index stack, and
      // put the duplicates where the selected elements used to be.
      // (the origin point where the dragging started)

      pointerDownState.hit.hasBeenDuplicated = true;

      const elements = editor.scene.getElementsIncludingDeleted();
      const hitElement = pointerDownState.hit.element;
      const selectedElements = editor.scene.getSelectedElements({
        selectedElementIds: editor.state.selectedElementIds,
        includeBoundTextElement: true,
        includeElementsInFrames: true,
      });
      if (
        hitElement &&
        // hit element may not end up being selected
        // if we're alt-dragging a common bounding box
        // over the hit element
        pointerDownState.hit.wasAddedToSelection &&
        !selectedElements.find((el) => el.id === hitElement.id)
      ) {
        selectedElements.push(hitElement);
      }

      const idsOfElementsToDuplicate = new Map(
        selectedElements.map((el) => [el.id, el]),
      );

      const {
        duplicatedElements,
        duplicateElementsMap,
        elementsWithDuplicates,
        origIdToDuplicateId,
      } = duplicateElements({
        type: "in-place",
        elements,
        appState: editor.state,
        randomizeSeed: true,
        idsOfElementsToDuplicate,
        overrides: ({ duplicateElement, origElement }) => {
          return {
            frameId: duplicateElement.frameId ?? origElement.frameId,
            seed: randomInteger(),
          };
        },
      });
      duplicatedElements.forEach((element) => {
        pointerDownState.originalElements.set(
          element.id,
          deepCopyElement(element),
        );
      });

      const mappedClonedElements = elementsWithDuplicates.map((el) => {
        if (idsOfElementsToDuplicate.has(el.id)) {
          const origEl = pointerDownState.originalElements.get(el.id);

          if (origEl) {
            return newElementWith(el, {
              x: origEl.x,
              y: origEl.y,
            });
          }
        }
        return el;
      });

      const elementsWithIndices = syncMovedIndices(
        mappedClonedElements,
        arrayToMap(duplicatedElements),
      );

      // swap hit element with the duplicated one
      if (pointerDownState.hit.element) {
        const cloneId = origIdToDuplicateId.get(
          pointerDownState.hit.element.id,
        );
        const clonedElement = cloneId && duplicateElementsMap.get(cloneId);
        pointerDownState.hit.element = (clonedElement as any) || null;
      }
      // swap hit elements with the duplicated ones
      pointerDownState.hit.allHitElements =
        pointerDownState.hit.allHitElements.reduce(
          (acc: typeof pointerDownState.hit.allHitElements, origHitElement) => {
            const cloneId = origIdToDuplicateId.get(origHitElement.id);
            const clonedElement = cloneId && duplicateElementsMap.get(cloneId);
            if (clonedElement) {
              acc.push(clonedElement as any);
            }

            return acc;
          },
          [],
        );

      // update drag origin to the position at which we started
      // the duplication so that the drag offset is correct
      pointerDownState.drag.origin = viewportCoordsToSceneCoords(
        event,
        editor.state,
      );

      // before the selection switch below, whose group resolution reads the
      // scene: upstream's own updater runs at the end of its `flushSync`,
      // i.e. once the duplicates are already in the scene
      editor.scene.replaceAllElements(elementsWithIndices);

      // switch selected elements to the duplicated ones
      editor.setState((prevState) => ({
        ...getSelectionStateForElements(
          duplicatedElements,
          editor.scene.getNonDeletedElements(),
          prevState,
        ),
      }));
      selectedElements.forEach((element) => {
        if (
          isBindableElement(element) &&
          element.boundElements?.some((other) => other.type === "arrow")
        ) {
          updateBoundElements(element, editor.scene);
        }
      });

      maybeCacheVisibleGaps(editor, event, selectedElements, true);
      maybeCacheReferenceSnapPoints(editor, event, selectedElements);
    }
  }

  return true;
};

/**
 * An elbow arrow bound to a shape that was itself dragged has been re-routed
 * point by point along the way; the release normalizes the route once, the
 * same way a direct edit of the arrow does.
 */
export const renormalizeBoundElbowArrowsOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  elementsMap: NonDeletedSceneElementsMap,
) => {
  if (
    !pointerDownState.drag.hasOccurred ||
    !pointerDownState.hit?.element?.id
  ) {
    return;
  }

  const element = elementsMap.get(pointerDownState.hit.element.id);
  if (isBindableElement(element)) {
    // Renormalize elbow arrows when they are changed via indirect move
    element.boundElements
      ?.filter((e) => e.type === "arrow")
      .map((e) => elementsMap.get(e.id))
      .filter((e) => isElbowArrow(e))
      .forEach((e) => {
        !!e && editor.scene.mutateElement(e, {});
      });
  }
};

export const cleanupAfterDragOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
) => {
  // schedule before the state flush below so the synchronous commit that the
  // flush triggers consumes the capture (upstream relies on React's deferred
  // post-handler commit instead)
  if (
    !isEditingTextContent(editor) &&
    (editor.state.activeTool.type !== "selection" ||
      isSomeElementSelected(
        editor.scene.getNonDeletedElements(),
        editor.state,
      ) ||
      !isShallowEqual(
        editor.state.previousSelectedElementIds,
        editor.state.selectedElementIds,
      ))
  ) {
    editor.store.scheduleCapture();
  }

  // just in case, tool changes mid drag, always clean up
  editor.lassoTrail.endPath();

  editor.setState((prevState) => ({
    isResizing: false,
    isRotating: false,
    isCropping: false,
    resizingElement: null,
    selectionElement: null,
    frameToHighlight: null,
    elementsToHighlight: null,
    cursorButton: "up" as const,
    selectedElementsAreBeingDragged: false,
    snapLines: updateStable(prevState.snapLines, []),
    originSnapOffset: null,
  }));

  SnapCache.setReferenceSnapPoints(null);
  SnapCache.setVisibleGaps(null);
};

/**
 * The tail of upstream's `onPointerUpFromPointerDownHandler` (`App.tsx`):
 * once every earlier branch has had its turn, a tool that isn't locked
 * reverts to the preferred selection tool. Caliburn's new-element branches
 * carry their own copies (`finalizeNewElementOnPointerUp`,
 * `finalizeLinearOnPointerUp`, the text and image paths); this is the copy
 * for the branch that ends the gesture with no `newElement` in hand — a
 * multi-point arrow finalized by its last click leaves `newElement` null
 * behind, and without this the arrow tool would stay armed.
 */
export const revertActiveToolOnPointerUp = (
  editor: CaliburnEditorComponent,
) => {
  const { activeTool } = editor.state;

  if (
    !editor.isToolLocked() &&
    activeTool.type !== "freedraw" &&
    // bucket fill stays active for back-to-back fills regardless of the
    // tool lock (paint-bucket UX)
    activeTool.type !== TOOL_TYPE.bucketfill &&
    (activeTool.type !== "lasso" ||
      // if lasso is turned on but from selection => reset to selection
      (activeTool.type === "lasso" && activeTool.fromSelection))
  ) {
    editor.setStateRevertingActiveTool({
      newElement: null,
      suggestedBinding: null,
      activeTool: updateActiveTool(editor.state, {
        type: editor.state.preferredSelectionTool.type,
      }),
    });
  } else {
    editor.setState({
      newElement: null,
      suggestedBinding: null,
    });
  }
};
