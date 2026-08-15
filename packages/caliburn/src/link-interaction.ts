import { pointDistance, pointFrom } from "@excalidraw/math";

import {
  CURSOR_TYPE,
  DRAGGING_THRESHOLD,
  isLocalLink,
  normalizeLink,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { isPointHittingLink } from "@excalidraw/excalidraw/components/hyperlink/helpers";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  hideHyperlinkToolip,
  showHyperlinkTooltip,
} from "./components/hyperlink/common";
import { getElementAtPosition } from "./selection-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

/** upstream `App.getElementLinkAtPosition` */
export const getElementLinkAtPosition = (
  editor: CaliburnEditorComponent,
  scenePointer: Readonly<{ x: number; y: number }>,
  hitElementMightBeLocked: NonDeletedExcalidrawElement | null,
): NonDeletedExcalidrawElement | undefined => {
  if (hitElementMightBeLocked && hitElementMightBeLocked.locked) {
    return undefined;
  }

  const elements = editor.scene.getNonDeletedElements();
  let hitElementIndex = -1;

  for (let index = elements.length - 1; index >= 0; index--) {
    const element = elements[index];
    if (hitElementMightBeLocked && element.id === hitElementMightBeLocked.id) {
      hitElementIndex = index;
    }
    if (
      element.link &&
      index >= hitElementIndex &&
      isPointHittingLink(
        element,
        editor.scene.getNonDeletedElementsMap(),
        editor.state,
        pointFrom(scenePointer.x, scenePointer.y),
        editor.editorInterface.formFactor === "phone",
      )
    ) {
      return element;
    }
  }

  return undefined;
};

/**
 * Upstream also routes the click through `props.onLinkOpen` before opening
 * the URL; caliburn has no such prop, so the link always opens directly.
 */
const handleElementLinkClick = (editor: CaliburnEditorComponent) => {
  const draggedDistance = pointDistance(
    pointFrom(
      editor.lastPointerDownEvent!.clientX,
      editor.lastPointerDownEvent!.clientY,
    ),
    pointFrom(
      editor.lastPointerUpEvent!.clientX,
      editor.lastPointerUpEvent!.clientY,
    ),
  );
  if (!editor.hitLinkElement || draggedDistance > DRAGGING_THRESHOLD) {
    return;
  }
  const lastPointerDownCoords = viewportCoordsToSceneCoords(
    editor.lastPointerDownEvent!,
    editor.state,
  );
  const elementsMap = editor.scene.getNonDeletedElementsMap();
  const lastPointerDownHittingLinkIcon = isPointHittingLink(
    editor.hitLinkElement,
    elementsMap,
    editor.state,
    pointFrom(lastPointerDownCoords.x, lastPointerDownCoords.y),
    editor.editorInterface.formFactor === "phone",
  );
  const lastPointerUpCoords = viewportCoordsToSceneCoords(
    editor.lastPointerUpEvent!,
    editor.state,
  );
  const lastPointerUpHittingLinkIcon = isPointHittingLink(
    editor.hitLinkElement,
    elementsMap,
    editor.state,
    pointFrom(lastPointerUpCoords.x, lastPointerUpCoords.y),
    editor.editorInterface.formFactor === "phone",
  );
  if (lastPointerDownHittingLinkIcon && lastPointerUpHittingLinkIcon) {
    hideHyperlinkToolip();
    let url = editor.hitLinkElement.link;
    if (url) {
      url = normalizeLink(url);
      const target = isLocalLink(url) ? "_self" : "_blank";
      const newWindow = window.open(undefined, target);
      // https://mathiasbynens.github.io/rel-noopener/
      if (newWindow) {
        newWindow.opener = null;
        newWindow.location = url;
      }
    }
  }
};

/**
 * Applies (or clears) the element-link hover affordances — pointer cursor
 * and tooltip — based on the current `hitLinkElement`. Returns whether a
 * link is being hovered.
 */
export const applyElementLinkHoverAffordance = (
  editor: CaliburnEditorComponent,
): boolean => {
  if (
    editor.hitLinkElement &&
    !editor.state.selectedElementIds[editor.hitLinkElement.id]
  ) {
    editor.cursor.set(CURSOR_TYPE.POINTER);

    showHyperlinkTooltip(
      editor.hitLinkElement,
      editor.state,
      editor.scene.getNonDeletedElementsMap(),
    );
    return true;
  }
  hideHyperlinkToolip();
  return false;
};

/**
 * On touchscreens (where no hover precedes the tap) re-derives
 * `hitLinkElement`, then opens the hit element link, if any.
 * Returns whether a link click was handled.
 */
export const maybeHandleElementLinkClick = (
  editor: CaliburnEditorComponent,
  scenePointer: { x: number; y: number },
): boolean => {
  if (editor.editorInterface.isTouchScreen) {
    const hitElement = getElementAtPosition(
      editor,
      scenePointer.x,
      scenePointer.y,
      {
        includeLockedElements: true,
      },
    );
    editor.hitLinkElement = getElementLinkAtPosition(
      editor,
      scenePointer,
      hitElement,
    );
  }

  if (
    editor.hitLinkElement &&
    editor.lastPointerDownEvent &&
    !editor.state.selectedElementIds[editor.hitLinkElement.id]
  ) {
    handleElementLinkClick(editor);
    return true;
  }
  return false;
};
