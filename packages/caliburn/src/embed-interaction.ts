import { pointDistance, pointFrom } from "@excalidraw/math";

import {
  CURSOR_TYPE,
  DRAGGING_THRESHOLD,
  POINTER_BUTTON,
  oneOf,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { isIframeLikeElement } from "@excalidraw/element";

import type {
  ExcalidrawIframeLikeElement,
  ExcalidrawElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { gesture, isHoldingSpace } from "./pan-gesture";
import { getElementAtPosition } from "./selection-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

const isIframeLikeElementCenter = (
  editor: CaliburnEditorComponent,
  el: ExcalidrawIframeLikeElement | null,
  event: PointerEvent,
  sceneX: number,
  sceneY: number,
) => {
  return (
    el &&
    !event.altKey &&
    !event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    (editor.state.activeEmbeddable?.element !== el ||
      editor.state.activeEmbeddable?.state === "hover" ||
      !editor.state.activeEmbeddable) &&
    sceneX >= el.x + el.width / 3 &&
    sceneX <= el.x + (2 * el.width) / 3 &&
    sceneY >= el.y + el.height / 3 &&
    sceneY <= el.y + (2 * el.height) / 3
  );
};

/** upstream `App.handleIframeLikeElementHover` */
export const handleIframeLikeElementHover = (
  editor: CaliburnEditorComponent,
  {
    hitElement,
    scenePointer,
    moveEvent,
  }: {
    hitElement: NonDeleted<ExcalidrawElement> | null;
    scenePointer: { x: number; y: number };
    moveEvent: PointerEvent;
  },
): boolean => {
  if (
    hitElement &&
    isIframeLikeElement(hitElement) &&
    (editor.state.viewModeEnabled ||
      editor.state.activeTool.type === "laser" ||
      isIframeLikeElementCenter(
        editor,
        hitElement,
        moveEvent,
        scenePointer.x,
        scenePointer.y,
      ))
  ) {
    editor.cursor.set(CURSOR_TYPE.POINTER);
    editor.setState({
      activeEmbeddable: { element: hitElement, state: "hover" },
    });
    return true;
  } else if (editor.state.activeEmbeddable?.state === "hover") {
    editor.setState({ activeEmbeddable: null });
  }
  return false;
};

/**
 * upstream `App.handleIframeLikeCenterClick`.
 *
 * @returns true if iframe-like element click handled
 *
 * Upstream continues past the activation to drive the embedded document
 * itself (the YouTube/Vimeo `postMessage` play/pause handshake, reached
 * through `App.getHTMLIFrameElement`). Those live on the rendered `<iframe>`
 * overlay — `App.renderEmbeddables`, which caliburn has not ported — so the
 * port ends where upstream's own `if (!iframe?.contentWindow) return true;`
 * would.
 */
export const handleIframeLikeCenterClick = (
  editor: CaliburnEditorComponent,
): boolean => {
  if (
    !editor.lastPointerDownEvent ||
    !editor.lastPointerUpEvent ||
    // middle-click or something other than primary
    editor.lastPointerDownEvent.button !== POINTER_BUTTON.MAIN ||
    // panning
    isHoldingSpace() ||
    // wrong tool
    !oneOf(editor.state.activeTool.type, ["laser", "selection", "lasso"])
  ) {
    return false;
  }

  const viewportClickStart_scenePoint = pointFrom(
    viewportCoordsToSceneCoords(
      {
        clientX: editor.lastPointerDownEvent.clientX,
        clientY: editor.lastPointerDownEvent.clientY,
      },
      editor.state,
    ),
  );
  const viewportClickEnd_scenePoint = pointFrom(
    viewportCoordsToSceneCoords(
      {
        clientX: editor.lastPointerUpEvent.clientX,
        clientY: editor.lastPointerUpEvent.clientY,
      },
      editor.state,
    ),
  );

  const draggedDistance = pointDistance(
    viewportClickStart_scenePoint,
    viewportClickEnd_scenePoint,
  );

  if (draggedDistance > DRAGGING_THRESHOLD) {
    return false;
  }

  const hitElement = getElementAtPosition(
    editor,
    viewportClickStart_scenePoint[0],
    viewportClickStart_scenePoint[1],
  );

  const shouldActivate =
    hitElement &&
    editor.lastPointerUpEvent.timeStamp -
      editor.lastPointerDownEvent.timeStamp <=
      300 &&
    gesture.pointers.size < 2 &&
    isIframeLikeElement(hitElement) &&
    (editor.state.viewModeEnabled ||
      editor.state.activeTool.type === "laser" ||
      isIframeLikeElementCenter(
        editor,
        hitElement,
        editor.lastPointerUpEvent,
        viewportClickEnd_scenePoint[0],
        viewportClickEnd_scenePoint[1],
      ));

  if (!shouldActivate) {
    return false;
  }

  const iframeLikeElement = hitElement;

  if (
    editor.state.activeEmbeddable?.element === iframeLikeElement &&
    editor.state.activeEmbeddable?.state === "active"
  ) {
    return true;
  }

  // The delay serves two purposes
  // 1. To prevent first click propagating to iframe on mobile,
  //    else the click will immediately start and stop the video
  // 2. If the user double clicks the frame center to activate it
  //    without the delay youtube will immediately open the video
  //    in fullscreen mode
  setTimeout(() => {
    editor.batchCommits(() =>
      editor.setState({
        activeEmbeddable: { element: iframeLikeElement, state: "active" },
        selectedElementIds: { [iframeLikeElement.id]: true },
        newElement: null,
        selectionElement: null,
      }),
    );
  }, 100);

  return true;
};
