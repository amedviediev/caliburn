import { viewportCoordsToSceneCoords } from "@excalidraw/common";
import {
  addElementsToFrame,
  elementOverlapsWithFrame,
  getCommonFrameId,
  getContainingFrame,
  getElementsInGroup,
  getElementsInResizingFrame,
  isElementInFrame,
  isEligibleFrameChildType,
  isFrameLikeElement,
  removeElementsFromFrame,
  replaceAllElementsInFrame,
  updateFrameMembershipOfSelectedElements,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { getTopLayerFrameAtSceneCoords } from "./text-interaction";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

export const updateFrameToHighlight = (
  editor: CaliburnEditorComponent,
  frameToHighlight: AppState["frameToHighlight"],
) => {
  if (editor.state.frameToHighlight !== frameToHighlight) {
    editor.setState({ frameToHighlight });
  }
};

export const maybeUpdateFrameToHighlightOnPointerMove = (
  editor: CaliburnEditorComponent,
  sceneCoords: { x: number; y: number },
) => {
  // currently this function is being called even during pointerdown so we
  // need to make sure we don't re-set the state when dragging and similar
  //
  // But, we still want to reset on pointermove in case the state is stale
  // so we updte even for non-eligible tool types
  if (
    editor.state.newElement ||
    editor.state.multiElement ||
    editor.state.selectionElement ||
    editor.state.selectedElementsAreBeingDragged
  ) {
    return;
  }

  updateFrameToHighlight(
    editor,
    isEligibleFrameChildType(editor.state.activeTool.type)
      ? getTopLayerFrameAtSceneCoords(editor, sceneCoords)
      : null,
  );
};

export const maybeUpdateFrameToHighlightOnDrag = (
  editor: CaliburnEditorComponent,
  pointerCoords: { x: number; y: number },
) => {
  const selectedElements = editor.scene.getSelectedElements(editor.state);
  const selectedElementsHasAFrame = selectedElements.some((e) =>
    isFrameLikeElement(e),
  );
  const frameToHighlight = selectedElementsHasAFrame
    ? null
    : getTopLayerFrameAtSceneCoords(editor, pointerCoords, {
        currentFrameId: getCommonFrameId(selectedElements),
        excludeElementIds: editor.state.selectedElementIds,
      });
  // Only update the state if there is a difference
  updateFrameToHighlight(editor, frameToHighlight);
};

export const updateFrameMembershipOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
) => {
  const elementsMap = editor.scene.getNonDeletedElementsMap();

  if (pointerDownState.drag.hasOccurred) {
    const sceneCoords = viewportCoordsToSceneCoords(event, editor.state);

    // when editing the points of a linear element, we check if the
    // linear element still is in the frame afterwards
    // if not, the linear element will be removed from its frame (if any)
    if (
      editor.state.selectedLinearElement &&
      editor.state.selectedLinearElement.isDragging
    ) {
      const linearElement = editor.scene.getElement(
        editor.state.selectedLinearElement.elementId,
      );

      if (linearElement?.frameId) {
        const frame = getContainingFrame(linearElement, elementsMap);

        if (frame && linearElement) {
          if (
            !elementOverlapsWithFrame(
              linearElement,
              frame,
              editor.scene.getNonDeletedElementsMap(),
            )
          ) {
            // remove the linear element from all groups
            // before removing it from the frame as well
            editor.scene.mutateElement(linearElement, {
              groupIds: [],
            });

            removeElementsFromFrame(
              [linearElement],
              editor.scene.getNonDeletedElementsMap(),
            );

            editor.scene.triggerUpdate();
          }
        }
      }
    } else {
      // update the relationships between selected elements and frames
      const selectedElements = editor.scene.getSelectedElements(editor.state);
      const topLayerFrame = getTopLayerFrameAtSceneCoords(editor, sceneCoords, {
        currentFrameId: getCommonFrameId(selectedElements),
        excludeElementIds: editor.state.selectedElementIds,
      });
      let nextElements = editor.scene.getElementsMapIncludingDeleted();

      const updateGroupIdsAfterEditingGroup = (
        elements: ExcalidrawElement[],
      ) => {
        if (elements.length > 0) {
          for (const element of elements) {
            const index = element.groupIds.indexOf(
              editor.state.editingGroupId!,
            );

            editor.scene.mutateElement(
              element,
              {
                groupIds: element.groupIds.slice(0, index),
              },
              { informMutation: false, isDragging: false },
            );
          }

          nextElements.forEach((element) => {
            if (
              element.groupIds.length &&
              getElementsInGroup(
                nextElements,
                element.groupIds[element.groupIds.length - 1],
              ).length < 2
            ) {
              editor.scene.mutateElement(
                element,
                {
                  groupIds: [],
                },
                { informMutation: false, isDragging: false },
              );
            }
          });

          editor.setState({
            editingGroupId: null,
          });
        }
      };

      if (topLayerFrame && !editor.state.selectedElementIds[topLayerFrame.id]) {
        const elementsToAdd = selectedElements.filter((element) =>
          isElementInFrame(element, nextElements, editor.state),
        );

        if (editor.state.editingGroupId) {
          updateGroupIdsAfterEditingGroup(elementsToAdd);
        }

        nextElements = addElementsToFrame(
          nextElements,
          elementsToAdd,
          topLayerFrame,
        );
      } else if (!topLayerFrame) {
        if (editor.state.editingGroupId) {
          const elementsToRemove = selectedElements.filter(
            (element) =>
              element.frameId &&
              !isElementInFrame(element, nextElements, editor.state),
          );

          updateGroupIdsAfterEditingGroup(elementsToRemove);
        }
      }

      const finalElements = updateFrameMembershipOfSelectedElements(
        nextElements,
        editor.state,
        editor as any,
      );

      editor.scene.replaceAllElements(finalElements);
    }
  }

  // handle frame membership for resizing frames and/or selected elements
  if (pointerDownState.resize.isResizing) {
    let nextElements = updateFrameMembershipOfSelectedElements(
      editor.scene.getElementsIncludingDeleted(),
      editor.state,
      editor as any,
    );

    const selectedFrames = editor.scene
      .getSelectedElements(editor.state)
      .filter(isFrameLikeElement);

    for (const frame of selectedFrames) {
      nextElements = replaceAllElementsInFrame(
        nextElements,
        getElementsInResizingFrame(
          editor.scene.getElementsIncludingDeleted(),
          frame,
          editor.state,
          elementsMap,
        ),
        frame,
      );
    }

    editor.scene.replaceAllElements(nextElements);
  }
};
