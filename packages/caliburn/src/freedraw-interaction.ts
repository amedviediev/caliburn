import {
  DEFAULT_STROKE_STREAMLINE,
  DEFAULT_STROKE_STREAMLINE_PRECISE,
  getGridPoint,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  makeNextSelectedElementIds,
  newFreeDrawElement,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";

import { actionFinalize } from "./actions/actionFinalize";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

export const handleFreeDrawElementOnPointerDown = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
  elementType: ExcalidrawFreeDrawElement["type"],
  pointerDownState: PointerDownState,
) => {
  // Begin a mark capture. This does not have to update state yet.
  const [gridX, gridY] = getGridPoint(
    pointerDownState.origin.x,
    pointerDownState.origin.y,
    null,
  );

  const simulatePressure = event.pressure === 0.5;

  const strokeVariability = editor.state.currentItemStrokeVariability;

  const element = newFreeDrawElement({
    type: elementType,
    x: gridX,
    y: gridY,
    strokeColor: editor.state.currentItemStrokeColor,
    backgroundColor: editor.state.currentItemBackgroundColor,
    fillStyle: editor.state.currentItemFillStyle,
    strokeWidth: editor.getCurrentItemStrokeWidth("freedraw"),
    strokeStyle: editor.state.currentItemStrokeStyle,
    roughness: editor.state.currentItemRoughness,
    opacity: editor.state.currentItemOpacity,
    roundness: null,
    simulatePressure,
    strokeOptions: {
      variability: strokeVariability,
      streamline:
        event.pointerType !== "mouse"
          ? DEFAULT_STROKE_STREAMLINE_PRECISE
          : DEFAULT_STROKE_STREAMLINE,
    },
    locked: false,
    frameId: null,
    points: [pointFrom<LocalPoint>(0, 0)],
    // pressures are only consumed when rendering a real-pressure stroke, so
    // skip persisting them while pressure is being simulated
    pressures: simulatePressure ? [] : [event.pressure],
  });

  editor.insertNewElement(element);

  editor.setState((prevState) => {
    const nextSelectedElementIds = {
      ...prevState.selectedElementIds,
    };
    delete nextSelectedElementIds[element.id];
    return {
      selectedElementIds: makeNextSelectedElementIds(
        nextSelectedElementIds,
        prevState,
      ),
    };
  });

  editor.setState({
    newElement: element,
    suggestedBinding: null,
  });
};

export const maybeDragFreeDrawElement = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): boolean => {
  const newElement = editor.state.newElement;
  if (newElement?.type !== "freedraw") {
    return false;
  }

  const pointerCoords = pointerDownState.lastCoords;
  const points = newElement.points;
  const dx = pointerCoords.x - newElement.x;
  const dy = pointerCoords.y - newElement.y;

  const lastPoint = points.length > 0 && points[points.length - 1];
  const discardPoint = lastPoint && lastPoint[0] === dx && lastPoint[1] === dy;

  if (!discardPoint) {
    const pressures = newElement.simulatePressure
      ? newElement.pressures
      : [...newElement.pressures, event.pressure];

    editor.scene.mutateElement(
      newElement,
      {
        points: [...points, pointFrom<LocalPoint>(dx, dy)],
        pressures,
      },
      {
        informMutation: false,
        isDragging: false,
      },
    );

    editor.setState({
      newElement,
    });
  }
  return true;
};

export const finalizeFreeDrawOnPointerUp = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
): void => {
  const newElement = editor.state.newElement;
  if (newElement?.type !== "freedraw") {
    return;
  }

  const pointerCoords = viewportCoordsToSceneCoords(event, editor.state);

  const points = newElement.points;
  let dx = pointerCoords.x - newElement.x;
  let dy = pointerCoords.y - newElement.y;

  // Allows dots to avoid being flagged as infinitely small
  if (dx === points[0][0] && dy === points[0][1]) {
    dy += 0.0001;
    dx += 0.0001;
  }

  const pressures = newElement.simulatePressure
    ? []
    : [...newElement.pressures, event.pressure];

  editor.scene.mutateElement(newElement, {
    points: [...points, pointFrom<LocalPoint>(dx, dy)],
    pressures,
  });

  editor.actionManager.executeAction(actionFinalize);
};
