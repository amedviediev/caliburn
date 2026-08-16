import { KEYS, getGridPoint } from "@excalidraw/common";
import {
  cropElement,
  getElementAbsoluteCoords,
  getUncroppedWidthAndHeight,
  isImageElement,
  isInitializedImageElement,
  updateBoundElements,
} from "@excalidraw/element";
import { snapResizingElements } from "@excalidraw/excalidraw/snapping";
import {
  clamp,
  pointFrom,
  pointRotateRads,
  vector,
  vectorDot,
  vectorFromPoint,
  vectorNormalize,
  vectorSubtract,
} from "@excalidraw/math";

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
 * upstream's `// #region move crop region` — the crop half of the drag
 * branch, ahead of the snapping and `dragSelectedElements` that would
 * otherwise move the element: a drag whose pointer-down hit the cropping
 * image itself (no transform handle involved) pans the image inside its
 * unchanged frame by moving the crop rectangle, and returns.
 *
 * `lastPointerCoords` is upstream's own local of that name, the previous
 * pointer-move's scene coords (`App.previousPointerMoveCoords`, falling
 * back to the drag origin) — the crop pans by the instantaneous delta, not
 * by the offset from the origin, so it must be read before the current move
 * overwrites it. Caliburn splits the pointer-move handler across modules,
 * so it is threaded down as a parameter instead of being a closure local.
 */
export const maybeMoveCropRegion = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  lastPointerCoords: { x: number; y: number },
): boolean => {
  const pointerCoords = pointerDownState.lastCoords;
  const elementsMap = editor.scene.getNonDeletedElementsMap();

  if (editor.state.croppingElementId) {
    const croppingElement = elementsMap.get(editor.state.croppingElementId);

    if (
      croppingElement &&
      isImageElement(croppingElement) &&
      croppingElement.crop !== null &&
      pointerDownState.hit.element === croppingElement
    ) {
      const crop = croppingElement.crop;
      const image =
        isInitializedImageElement(croppingElement) &&
        editor.imageCache.get(croppingElement.fileId)?.image;

      if (image && !(image instanceof Promise)) {
        const uncroppedSize = getUncroppedWidthAndHeight(croppingElement);
        const instantDragOffset = vector(
          pointerCoords.x - lastPointerCoords.x,
          pointerCoords.y - lastPointerCoords.y,
        );

        // to reduce cursor:image drift, we need to take into account
        // the canvas image element scaling so we can accurately
        // track the pixels on movement
        instantDragOffset[0] *= image.naturalWidth / uncroppedSize.width;
        instantDragOffset[1] *= image.naturalHeight / uncroppedSize.height;

        const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
          croppingElement,
          elementsMap,
        );

        const topLeft = vectorFromPoint(
          pointRotateRads(
            pointFrom(x1, y1),
            pointFrom(cx, cy),
            croppingElement.angle,
          ),
        );
        const topRight = vectorFromPoint(
          pointRotateRads(
            pointFrom(x2, y1),
            pointFrom(cx, cy),
            croppingElement.angle,
          ),
        );
        const bottomLeft = vectorFromPoint(
          pointRotateRads(
            pointFrom(x1, y2),
            pointFrom(cx, cy),
            croppingElement.angle,
          ),
        );
        const topEdge = vectorNormalize(vectorSubtract(topRight, topLeft));
        const leftEdge = vectorNormalize(vectorSubtract(bottomLeft, topLeft));

        // project instantDrafOffset onto leftEdge and topEdge to decompose
        const offsetVector = vector(
          vectorDot(instantDragOffset, topEdge),
          vectorDot(instantDragOffset, leftEdge),
        );

        const nextCrop = {
          ...crop,
          x: clamp(
            crop.x - offsetVector[0] * Math.sign(croppingElement.scale[0]),
            0,
            image.naturalWidth - crop.width,
          ),
          y: clamp(
            crop.y - offsetVector[1] * Math.sign(croppingElement.scale[1]),
            0,
            image.naturalHeight - crop.height,
          ),
        };

        editor.scene.mutateElement(croppingElement, {
          crop: nextCrop,
        });

        return true;
      }
    }
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
