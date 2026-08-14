import {
  KEYS,
  arrayToMap,
  randomInteger,
  tupleToCoors,
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

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { KeyboardModifiersObject } from "@excalidraw/excalidraw/types";

import { getEffectiveGridSize } from "./create-interaction";

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

const maybeCacheReferenceSnapPoints = (
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
    )
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

  // Marking that click was used for dragging to check
  // if elements should be deselected on pointerup
  pointerDownState.drag.hasOccurred = true;

  // prevent dragging even if we're no longer holding cmd/ctrl otherwise
  // it would have weird results (stuff jumping all over the screen)
  if (selectedElements.length > 0 && !pointerDownState.withCmdOrCtrl) {
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

      // switch selected elements to the duplicated ones
      editor.setState((prevState) => ({
        ...getSelectionStateForElements(
          duplicatedElements,
          editor.scene.getNonDeletedElements(),
          prevState,
        ),
      }));

      editor.scene.replaceAllElements(elementsWithIndices);
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

export const cleanupAfterDragOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
) => {
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

  if (
    editor.state.activeTool.type !== "selection" ||
    isSomeElementSelected(editor.scene.getNonDeletedElements(), editor.state)
  ) {
    editor.store.scheduleCapture();
  }
};
