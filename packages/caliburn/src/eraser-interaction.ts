import { viewportCoordsToSceneCoords } from "@excalidraw/common";
import {
  isBindableElement,
  isBindingElement,
  isBoundToContainer,
  mutateElement,
  newElementWith,
} from "@excalidraw/element";
import { pointDistance, pointFrom } from "@excalidraw/math";

import { isEraserActive } from "@excalidraw/excalidraw/appState";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { getElementsAtPosition } from "./selection-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

/**
 * Upstream re-renders through `triggerRender()`, i.e. `setState({})`: the
 * pending-erasure set is a plain field rather than app state, so the render
 * that reads it has to be asked for by hand. Caliburn's `setState` commits
 * and re-renders the same way.
 */
const triggerRender = (editor: CaliburnEditorComponent) => {
  editor.setState({});
};

export const handleEraser = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
  scenePointer: { x: number; y: number },
) => {
  const elementsToErase = editor.eraserTrail.addPointToPath(
    scenePointer.x,
    scenePointer.y,
    event.altKey,
  );

  editor.elementsPendingErasure = new Set(elementsToErase);
  triggerRender(editor);
};

export const restoreReadyToEraseElements = (
  editor: CaliburnEditorComponent,
) => {
  editor.elementsPendingErasure = new Set();
  triggerRender(editor);
};

export const eraseElements = (editor: CaliburnEditorComponent) => {
  let didChange = false;

  // Binding is double accounted on both elements and if one of them is
  // deleted, the binding should be removed
  editor.elementsPendingErasure.forEach((id) => {
    const element = editor.scene.getElement(id);
    if (isBindingElement(element)) {
      if (element.startBinding) {
        const bindable = editor.scene.getElement(
          element.startBinding.elementId,
        )!;
        // NOTE: We use the raw mutateElement() because we don't want history
        // entries or multiplayer updates
        mutateElement(bindable, editor.scene.getElementsMapIncludingDeleted(), {
          boundElements: bindable.boundElements!.filter(
            (e) => e.id !== element.id,
          ),
        });
      }
      if (element.endBinding) {
        const bindable = editor.scene.getElement(element.endBinding.elementId)!;
        // NOTE: We use the raw mutateElement() because we don't want history
        // entries or multiplayer updates
        mutateElement(bindable, editor.scene.getElementsMapIncludingDeleted(), {
          boundElements: bindable.boundElements!.filter(
            (e) => e.id !== element.id,
          ),
        });
      }
    } else if (isBindableElement(element)) {
      element.boundElements?.forEach((boundElement) => {
        if (boundElement.type === "arrow") {
          const arrow = editor.scene.getElement(
            boundElement.id,
          ) as ExcalidrawArrowElement;
          if (arrow?.startBinding?.elementId === element.id) {
            // NOTE: We use the raw mutateElement() because we don't want history
            // entries or multiplayer updates
            mutateElement(
              arrow,
              editor.scene.getElementsMapIncludingDeleted(),
              {
                startBinding: null,
              },
            );
          }
          if (arrow?.endBinding?.elementId === element.id) {
            // NOTE: We use the raw mutateElement() because we don't want history
            // entries or multiplayer updates
            mutateElement(
              arrow,
              editor.scene.getElementsMapIncludingDeleted(),
              {
                endBinding: null,
              },
            );
          }
        }
      });
    }
  });

  const elements = editor.scene.getElementsIncludingDeleted().map((ele) => {
    if (
      editor.elementsPendingErasure.has(ele.id) ||
      (ele.frameId && editor.elementsPendingErasure.has(ele.frameId)) ||
      (isBoundToContainer(ele) &&
        editor.elementsPendingErasure.has(ele.containerId))
    ) {
      didChange = true;
      return newElementWith(ele, { isDeleted: true });
    }
    return ele;
  });

  editor.elementsPendingErasure = new Set();

  if (didChange) {
    editor.store.scheduleCapture();
    editor.scene.replaceAllElements(elements);
  }
};

/**
 * Upstream's eraser branch of `onPointerUpFromPointerDownHandler` — returns
 * whether it consumed the pointer up, as upstream's `return` does.
 */
export const maybeEraseOnPointerUp = (
  editor: CaliburnEditorComponent,
): boolean => {
  const pointerStart = editor.lastPointerDownEvent;
  const pointerEnd = editor.lastPointerUpEvent || editor.lastPointerMoveEvent;

  if (isEraserActive(editor.state) && pointerStart && pointerEnd) {
    editor.eraserTrail.endPath();

    const draggedDistance = pointDistance(
      pointFrom(pointerStart.clientX, pointerStart.clientY),
      pointFrom(pointerEnd.clientX, pointerEnd.clientY),
    );

    if (draggedDistance === 0) {
      const scenePointer = viewportCoordsToSceneCoords(
        {
          clientX: pointerEnd.clientX,
          clientY: pointerEnd.clientY,
        },
        editor.state,
      );
      const hitElements = getElementsAtPosition(
        editor,
        scenePointer.x,
        scenePointer.y,
      );
      hitElements.forEach((hitElement) =>
        editor.elementsPendingErasure.add(hitElement.id),
      );
    }
    eraseElements(editor);
    return true;
  } else if (editor.elementsPendingErasure.size) {
    restoreReadyToEraseElements(editor);
  }
  return false;
};
