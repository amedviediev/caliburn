import { KEYS, getGridPoint } from "@excalidraw/common";
import {
  cropElement,
  isImageElement,
  isInitializedImageElement,
  updateBoundElements,
} from "@excalidraw/element";
import { snapResizingElements } from "@excalidraw/excalidraw/snapping";

import { getEffectiveGridSize } from "./create-interaction";
import { maybeCacheReferenceSnapPoints } from "./drag-interaction";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

/**
 * upstream `App.finishImageCropping` — the crop-mode exit. Reached from the
 * Escape/Enter keyboard shortcut, from a pointer-down that hits a different
 * element while cropping, and from the pointer-up "click outside" check
 * below.
 */
export const finishImageCropping = (editor: CaliburnEditorComponent) => {
  if (editor.state.croppingElementId) {
    editor.store.scheduleCapture();
    editor.setState({
      croppingElementId: null,
    });
  }
};

/**
 * upstream `App.maybeHandleCrop` — the crop-mode counterpart of
 * `maybeHandleResize`, called first in the same pointer-move dispatch: a
 * transform-handle drag while `croppingElementId` is set mutates the crop
 * rectangle via the vendored `cropElement` instead of resizing the image.
 */
export const maybeHandleCrop = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): boolean => {
  // to crop, we must already be in the cropping mode, where croppingElement has been set
  if (!editor.state.croppingElementId) {
    return false;
  }

  const transformHandleType = pointerDownState.resize.handleType;
  const pointerCoords = pointerDownState.lastCoords;
  const [x, y] = getGridPoint(
    pointerCoords.x - pointerDownState.resize.offset.x,
    pointerCoords.y - pointerDownState.resize.offset.y,
    event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
  );

  const croppingElement = editor.scene
    .getNonDeletedElementsMap()
    .get(editor.state.croppingElementId);

  if (
    transformHandleType &&
    croppingElement &&
    isImageElement(croppingElement)
  ) {
    const croppingAtStateStart = pointerDownState.originalElements.get(
      croppingElement.id,
    );

    const image =
      isInitializedImageElement(croppingElement) &&
      editor.imageCache.get(croppingElement.fileId)?.image;

    if (
      croppingAtStateStart &&
      isImageElement(croppingAtStateStart) &&
      image &&
      !(image instanceof Promise)
    ) {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
      );

      const dragOffset = {
        x: gridX - pointerDownState.originInGrid.x,
        y: gridY - pointerDownState.originInGrid.y,
      };

      maybeCacheReferenceSnapPoints(editor, event, [croppingElement]);

      const { snapOffset, snapLines } = snapResizingElements(
        [croppingElement],
        [croppingAtStateStart],
        editor as any,
        event,
        dragOffset,
        transformHandleType,
      );

      editor.scene.mutateElement(
        croppingElement,
        cropElement(
          croppingElement,
          editor.scene.getNonDeletedElementsMap(),
          transformHandleType,
          image.naturalWidth,
          image.naturalHeight,
          x + snapOffset.x,
          y + snapOffset.y,
          event.shiftKey
            ? croppingAtStateStart.width / croppingAtStateStart.height
            : undefined,
        ),
      );

      updateBoundElements(croppingElement, editor.scene);

      editor.setState({
        isCropping: !!transformHandleType && transformHandleType !== "rotation",
        snapLines,
      });
    }

    return true;
  }

  return false;
};

/**
 * upstream's "click outside the cropping region to exit" — part of the
 * pointer-up teardown's flat sequence, reading `croppingElementId` and
 * `isCropping` off state before `cleanupAfterDragOnPointerUp` resets the
 * latter, exactly as upstream destructures them at the top of its handler.
 */
export const maybeFinishImageCroppingOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
) => {
  const { croppingElementId, isCropping } = editor.state;
  const hitElement = pointerDownState.hit.element;

  if (
    // not in the cropping mode at all
    !croppingElementId ||
    // in the cropping mode
    (croppingElementId &&
      // not cropping and no hit element
      ((!hitElement && !isCropping) ||
        // hitting something else
        (hitElement && hitElement.id !== croppingElementId)))
  ) {
    finishImageCropping(editor);
  }
};
