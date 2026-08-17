import {
  FRAME_STYLE,
  KEYS,
  ROUNDNESS,
  TOOL_TYPE,
  distance,
  getGridPoint,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  tupleToCoors,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  addElementsToFrame,
  dragNewElement,
  getElementsInNewFrame,
  getElementsInResizingFrame,
  getNormalizedDimensions,
  isEmbeddableElement,
  isFrameLikeElement,
  isInvisiblySmallElement,
  isSomeElementSelected,
  isUsingAdaptiveRadius,
  makeNextSelectedElementIds,
  newElement,
  newEmbeddableElement,
  newFrameElement,
  newMagicFrameElement,
} from "@excalidraw/element";
import {
  SnapCache,
  getReferenceSnapPoints,
  isGridModeEnabled,
  isSnappingEnabled,
  snapNewElement,
} from "@excalidraw/excalidraw/snapping";

import { updateActiveTool } from "@excalidraw/common";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawGenericElement,
} from "@excalidraw/element/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type {
  KeyboardModifiersObject,
  NullableGridSize,
  ToolType,
} from "@excalidraw/excalidraw/types";

import { getTopLayerFrameAtSceneCoords } from "./text-interaction";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

export const getEffectiveGridSize = (editor: CaliburnEditorComponent) => {
  return (
    isGridModeEnabled(editor as any) ? editor.state.gridSize : null
  ) as NullableGridSize;
};

export const getCurrentItemRoundness = (
  editor: CaliburnEditorComponent,
  elementType:
    | "selection"
    | "rectangle"
    | "diamond"
    | "ellipse"
    | "iframe"
    | "embeddable",
) => {
  return editor.state.currentItemRoundness === "round"
    ? {
        type: isUsingAdaptiveRadius(elementType)
          ? ROUNDNESS.ADAPTIVE_RADIUS
          : ROUNDNESS.PROPORTIONAL_RADIUS,
      }
    : null;
};

export const originInGridFromEvent = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
) => {
  const origin = viewportCoordsToSceneCoords(event, editor.state);
  return tupleToCoors(
    getGridPoint(
      origin.x,
      origin.y,
      event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
    ),
  );
};

export const createGenericElementOnPointerDown = (
  editor: CaliburnEditorComponent,
  elementType: ExcalidrawGenericElement["type"] | "embeddable",
  pointerDownState: PointerDownState,
): void => {
  const [gridX, gridY] = getGridPoint(
    pointerDownState.origin.x,
    pointerDownState.origin.y,
    pointerDownState.withCmdOrCtrl ? null : getEffectiveGridSize(editor),
  );

  const topLayerFrame = getTopLayerFrameAtSceneCoords(editor, {
    x: gridX,
    y: gridY,
  });

  const baseElementAttributes = {
    x: gridX,
    y: gridY,
    strokeColor: editor.state.currentItemStrokeColor,
    backgroundColor: editor.state.currentItemBackgroundColor,
    fillStyle: editor.state.currentItemFillStyle,
    strokeWidth: editor.getCurrentItemStrokeWidth(elementType),
    strokeStyle: editor.state.currentItemStrokeStyle,
    roughness: editor.state.currentItemRoughness,
    opacity: editor.state.currentItemOpacity,
    roundness: getCurrentItemRoundness(editor, elementType),
    locked: false,
    frameId: topLayerFrame ? topLayerFrame.id : null,
  } as const;

  let element;
  if (elementType === "embeddable") {
    element = newEmbeddableElement({
      type: "embeddable",
      ...baseElementAttributes,
    });
  } else {
    element = newElement({
      type: elementType,
      ...baseElementAttributes,
    });
  }

  if (element.type === "selection") {
    editor.setState({
      selectionElement: element,
    });
  } else {
    editor.insertNewElement(element);
    editor.setState({
      multiElement: null,
      newElement: element,
    });
  }
};

export const createFrameElementOnPointerDown = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  type: Extract<ToolType, "frame" | "magicframe">,
): void => {
  const [gridX, gridY] = getGridPoint(
    pointerDownState.origin.x,
    pointerDownState.origin.y,
    editor.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
      ? null
      : getEffectiveGridSize(editor),
  );

  const constructorOpts = {
    x: gridX,
    y: gridY,
    opacity: editor.state.currentItemOpacity,
    locked: false,
    ...FRAME_STYLE,
  } as const;

  const frame =
    type === TOOL_TYPE.magicframe
      ? newMagicFrameElement(constructorOpts)
      : newFrameElement(constructorOpts);

  editor.insertNewElement(frame);

  editor.setState({
    multiElement: null,
    newElement: frame,
  });
};

const maybeCacheReferenceSnapPoints = (
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
    (recomputeAnyways || !SnapCache.getReferenceSnapPoints())
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

export const maybeDragNewElement = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
  informMutation = true,
): void => {
  const newElement = editor.state.newElement;
  const pointerCoords = pointerDownState.lastCoords;
  if (!newElement) {
    return;
  }

  if (editor.arrowText.maybeDragNewText(newElement, pointerCoords)) {
    return;
  }

  let [gridX, gridY] = getGridPoint(
    pointerCoords.x,
    pointerCoords.y,
    event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
  );

  maybeCacheReferenceSnapPoints(editor, event, [newElement]);

  const { snapOffset, snapLines } = snapNewElement(
    newElement,
    editor as any,
    event,
    {
      x:
        pointerDownState.originInGrid.x +
        (editor.state.originSnapOffset?.x ?? 0),
      y:
        pointerDownState.originInGrid.y +
        (editor.state.originSnapOffset?.y ?? 0),
    },
    {
      x: gridX - pointerDownState.originInGrid.x,
      y: gridY - pointerDownState.originInGrid.y,
    },
    editor.scene.getNonDeletedElementsMap(),
  );

  gridX += snapOffset.x;
  gridY += snapOffset.y;

  editor.setState({
    snapLines,
  });

  dragNewElement({
    newElement,
    elementType: editor.state.activeTool.type,
    originX: pointerDownState.originInGrid.x,
    originY: pointerDownState.originInGrid.y,
    x: gridX,
    y: gridY,
    width: distance(pointerDownState.originInGrid.x, gridX),
    height: distance(pointerDownState.originInGrid.y, gridY),
    shouldMaintainAspectRatio: shouldMaintainAspectRatio(event),
    shouldResizeFromCenter: shouldResizeFromCenter(event),
    zoom: editor.state.zoom.value,
    scene: editor.scene,
    widthAspectRatio: null,
    originOffset: editor.state.originSnapOffset,
    informMutation,
  });

  editor.setState({
    newElement,
  });

  // highlight elements that are to be added to frames on frames creation
  if (
    editor.state.activeTool.type === TOOL_TYPE.frame ||
    editor.state.activeTool.type === TOOL_TYPE.magicframe
  ) {
    editor.setState({
      elementsToHighlight: getElementsInResizingFrame(
        editor.scene.getNonDeletedElements(),
        newElement as ExcalidrawFrameLikeElement,
        editor.state,
        editor.scene.getNonDeletedElementsMap(),
      ) as NonDeletedExcalidrawElement[], // Obvious typecast, no need to runtime typecheck
    });
  }
};

export const finalizeNewElementOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
): void => {
  const newElement = editor.state.newElement;
  const activeTool = editor.state.activeTool;

  if (!newElement) {
    return;
  }

  if (activeTool.type !== "selection" && isInvisiblySmallElement(newElement)) {
    // remove invisible element which was added in onPointerDown
    // update the store snapshot, so that invisible elements are not captured by the store
    editor.updateScene({
      elements: editor.scene
        .getElementsIncludingDeleted()
        .filter((el) => el.id !== newElement.id),
      appState: {
        newElement: null,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    return;
  }

  if (isFrameLikeElement(newElement)) {
    const elementsInsideFrame = getElementsInNewFrame(
      editor.scene.getElementsIncludingDeleted(),
      newElement,
      editor.scene.getNonDeletedElementsMap(),
    );

    editor.scene.replaceAllElements(
      addElementsToFrame(
        editor.scene.getElementsMapIncludingDeleted(),
        elementsInsideFrame,
        newElement,
      ),
    );
  }

  editor.scene.mutateElement(newElement, getNormalizedDimensions(newElement), {
    informMutation: false,
    isDragging: false,
  });
  // the above does not guarantee the scene to be rendered again, hence the trigger below
  editor.scene.triggerUpdate();

  if (!editor.isToolLocked() && activeTool.type !== "freedraw") {
    editor.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds(
        {
          ...prevState.selectedElementIds,
          [newElement.id]: true,
        },
        prevState,
      ),
      showHyperlinkPopup:
        isEmbeddableElement(newElement) && !newElement.link
          ? "editor"
          : prevState.showHyperlinkPopup,
    }));
  }

  if (
    activeTool.type !== "selection" ||
    isSomeElementSelected(editor.scene.getNonDeletedElements(), editor.state)
  ) {
    editor.store.scheduleCapture();
  }

  if (!editor.isToolLocked() && activeTool.type !== "freedraw") {
    editor.setState({
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
