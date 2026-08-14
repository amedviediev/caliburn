import {
  ARROW_TYPE,
  KEYS,
  LINE_CONFIRM_THRESHOLD,
  MINIMUM_ARROW_SIZE,
  ROUNDNESS,
  getGridPoint,
  invariant,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  LinearElementEditor,
  bindOrUnbindBindingElement,
  getBindingStrategyForDraggingBindingElementEndpoints,
  getHoveredElementForBinding,
  getSnapOutlineMidPoint,
  isBindingElement,
  isBindingEnabled,
  isElbowArrow,
  isLinearElement,
  isPathALoop,
  isPointInElement,
  makeNextSelectedElementIds,
  maxBindingDistance_simple,
  newArrowElement,
  newLinearElement,
} from "@excalidraw/element";
import { pointDistance, pointFrom } from "@excalidraw/math";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";
import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import { actionFinalize } from "./actions/actionFinalize";
import { getEffectiveGridSize } from "./create-interaction";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

export const handleLinearElementOnPointerDown = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
  elementType: ExcalidrawLinearElement["type"],
  pointerDownState: PointerDownState,
): void => {
  if (event.ctrlKey) {
    editor.setState({
      isBindingEnabled: editor.state.bindingPreference !== "enabled",
    });
  }

  if (editor.state.multiElement) {
    const { multiElement, selectedLinearElement } = editor.state;

    invariant(
      selectedLinearElement,
      "selectedLinearElement is expected to be set",
    );

    // finalize if completing a loop
    if (
      multiElement.type === "line" &&
      isPathALoop(multiElement.points, editor.state.zoom.value)
    ) {
      editor.setState({
        selectedLinearElement: {
          ...selectedLinearElement,
          lastCommittedPoint:
            multiElement.points[multiElement.points.length - 1],
          initialState: {
            ...selectedLinearElement.initialState,
            lastClickedPoint: -1, // Disable dragging
          },
        },
      });
      editor.actionManager.executeAction(actionFinalize);
      return;
    }

    // Elbow arrows cannot be created by putting down points
    // only the start and end points can be defined
    if (isElbowArrow(multiElement) && multiElement.points.length > 1) {
      editor.actionManager.executeAction(actionFinalize, "ui", {
        event,
        sceneCoords: {
          x: pointerDownState.origin.x,
          y: pointerDownState.origin.y,
        },
      });
      return;
    }

    const { x: rx, y: ry } = multiElement;
    const { lastCommittedPoint } = selectedLinearElement;
    const sceneCoords = viewportCoordsToSceneCoords(event, editor.state);
    const { start, end } =
      isBindingElement(multiElement) && isBindingEnabled(editor.state)
        ? getBindingStrategyForDraggingBindingElementEndpoints(
            multiElement,
            new Map([
              [
                multiElement.points.length - 1,
                {
                  point: multiElement.points[multiElement.points.length - 1],
                  isDragging: false,
                },
              ],
            ]),
            sceneCoords.x,
            sceneCoords.y,
            editor.scene.getNonDeletedElementsMap(),
            editor.scene.getNonDeletedElements(),
            editor.state,
            {
              newArrow: Boolean(editor.state.newElement),
              zoom: editor.state.zoom,
            },
          )
        : { start: undefined, end: { mode: undefined } as any };

    const elementsMap = editor.scene.getNonDeletedElementsMap();
    // Auto-confirm when both ends bind to the SAME element and the end point
    // lands on the outline rather than inside it
    const endOutsideSameElement =
      start?.mode != null &&
      end.mode != null &&
      start.element.id === end.element.id &&
      !isPointInElement(end.focusPoint, end.element, elementsMap);
    const boundOutsideFromElsewhere =
      end.mode === "orbit" &&
      multiElement.startBinding?.elementId !== end.element?.id;
    const lastCommittedPointIsInsideCommitZone =
      lastCommittedPoint &&
      pointDistance(
        pointFrom(
          pointerDownState.origin.x - rx,
          pointerDownState.origin.y - ry,
        ),
        lastCommittedPoint,
      ) < LINE_CONFIRM_THRESHOLD;

    // clicking inside commit zone → finalize arrow
    if (
      boundOutsideFromElsewhere || // Outside -> orbit: Bind immediately
      endOutsideSameElement || // End outside the start's element: Bind immediately
      (multiElement.points.length > 1 && lastCommittedPointIsInsideCommitZone)
    ) {
      editor.actionManager.executeAction(actionFinalize, "ui", {
        event,
        sceneCoords: {
          x: pointerDownState.origin.x,
          y: pointerDownState.origin.y,
        },
      });
      return;
    }

    editor.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds(
        {
          ...prevState.selectedElementIds,
          [multiElement.id]: true,
        },
        prevState,
      ),
    }));
  } else {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
    );

    /* If arrow is pre-arrowheads, it will have undefined for both start and end arrowheads.
    If so, we want it to be null for start and "arrow" for end. If the linear item is not
    an arrow, we want it to be null for both. Otherwise, we want it to use the
    values from appState. */

    const { currentItemStartArrowhead, currentItemEndArrowhead } = editor.state;
    const [startArrowhead, endArrowhead] =
      elementType === "arrow"
        ? [currentItemStartArrowhead, currentItemEndArrowhead]
        : [null, null];

    const element =
      elementType === "arrow"
        ? newArrowElement({
            type: elementType,
            x: gridX,
            y: gridY,
            strokeColor: editor.state.currentItemStrokeColor,
            backgroundColor: editor.state.currentItemBackgroundColor,
            fillStyle: editor.state.currentItemFillStyle,
            strokeWidth: editor.getCurrentItemStrokeWidth(elementType),
            strokeStyle: editor.state.currentItemStrokeStyle,
            roughness: editor.state.currentItemRoughness,
            opacity: editor.state.currentItemOpacity,
            roundness:
              editor.state.currentItemArrowType === ARROW_TYPE.round
                ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                : // note, roundness doesn't have any effect for elbow arrows,
                  // but it's best to set it to null as well
                  null,
            startArrowhead,
            endArrowhead,
            locked: false,
            frameId: null,
            elbowed: editor.state.currentItemArrowType === ARROW_TYPE.elbow,
            fixedSegments:
              editor.state.currentItemArrowType === ARROW_TYPE.elbow
                ? []
                : null,
          })
        : newLinearElement({
            type: elementType,
            x: gridX,
            y: gridY,
            strokeColor: editor.state.currentItemStrokeColor,
            backgroundColor: editor.state.currentItemBackgroundColor,
            fillStyle: editor.state.currentItemFillStyle,
            strokeWidth: editor.getCurrentItemStrokeWidth(elementType),
            strokeStyle: editor.state.currentItemStrokeStyle,
            roughness: editor.state.currentItemRoughness,
            opacity: editor.state.currentItemOpacity,
            roundness:
              editor.state.currentItemRoundness === "round"
                ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                : null,
            locked: false,
            frameId: null,
          });

    const point = pointFrom<GlobalPoint>(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
    );
    const elementsMap = editor.scene.getNonDeletedElementsMap();
    const boundElement = isBindingEnabled(editor.state)
      ? getHoveredElementForBinding(
          point,
          editor.scene.getNonDeletedElements(),
          elementsMap,
        )
      : null;

    editor.scene.mutateElement(element, {
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 0)],
    });

    editor.insertNewElement(element);

    if (isBindingElement(element)) {
      // Do the initial binding so the binding strategy has the initial state
      bindOrUnbindBindingElement(
        element,
        new Map([
          [
            0,
            {
              point: pointFrom<LocalPoint>(0, 0),
              isDragging: false,
            },
          ],
        ]),
        point[0],
        point[1],
        editor.scene,
        editor.state,
        {
          newArrow: true,
          altKey: event.altKey,
          initialBinding: true,
          angleLocked: false,
        },
      );
    }

    editor.setState((prevState) => {
      let linearElementEditor = null;
      let nextSelectedElementIds = prevState.selectedElementIds;
      if (isLinearElement(element)) {
        linearElementEditor = new LinearElementEditor(
          element,
          editor.scene.getNonDeletedElementsMap(),
        );

        const endIdx = element.points.length - 1;
        linearElementEditor = {
          ...linearElementEditor,
          selectedPointsIndices: [endIdx],
          initialState: {
            ...linearElementEditor.initialState,
            arrowStartIsInside: event.altKey,
            lastClickedPoint: endIdx,
            origin: pointFrom<GlobalPoint>(
              pointerDownState.origin.x,
              pointerDownState.origin.y,
            ),
          },
        };
      }

      nextSelectedElementIds = !editor.isToolLocked()
        ? makeNextSelectedElementIds({ [element.id]: true }, prevState)
        : prevState.selectedElementIds;

      return {
        ...prevState,
        bindMode: "orbit" as const,
        newElement: element,
        suggestedBinding:
          boundElement && isBindingElement(element)
            ? {
                element: boundElement,
                midPoint: getSnapOutlineMidPoint(
                  point,
                  boundElement,
                  elementsMap,
                  editor.state.zoom,
                ),
              }
            : null,
        selectedElementIds: nextSelectedElementIds,
        selectedLinearElement: linearElementEditor,
      };
    });
  }
};

/**
 * Drags the actively created/edited linear element point during a
 * pointer-down session. Returns true when the event was consumed.
 */
export const maybeDragLinearPoint = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): boolean => {
  const linearElementEditor = editor.state.selectedLinearElement;
  if (
    !linearElementEditor ||
    linearElementEditor.initialState.lastClickedPoint === -1
  ) {
    return false;
  }

  const pointerCoords = pointerDownState.lastCoords;
  const elementsMap = editor.scene.getNonDeletedElementsMap();
  const element = LinearElementEditor.getElement(
    linearElementEditor.elementId,
    elementsMap,
  );

  if (!element || element.isDeleted) {
    return true;
  }

  const newState = LinearElementEditor.handlePointDragging(
    event,
    editor as any,
    pointerCoords.x,
    pointerCoords.y,
    linearElementEditor,
  );

  if (newState) {
    pointerDownState.drag.hasOccurred = true;
    editor.setState(newState);
    return true;
  }

  return false;
};

/**
 * Hover-move handling while a multi-point element is being laid down:
 * adds/removes the uncommitted trailing point and drags it along.
 */
export const handleMultiElementPointerMove = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
) => {
  const { multiElement, selectedLinearElement } = editor.state;
  if (!multiElement || !selectedLinearElement) {
    return;
  }

  const { x: scenePointerX, y: scenePointerY } = viewportCoordsToSceneCoords(
    event,
    editor.state,
  );

  const { x: rx, y: ry, points } = multiElement;
  const lastPoint = points[points.length - 1];

  const { lastCommittedPoint } = selectedLinearElement;

  if (lastPoint === lastCommittedPoint) {
    if (
      // if we haven't yet created a temp point and we're beyond commit-zone
      // threshold, add a point
      pointDistance(
        pointFrom(scenePointerX - rx, scenePointerY - ry),
        lastPoint,
      ) >= LINE_CONFIRM_THRESHOLD
    ) {
      editor.store.scheduleCapture();
      invariant(
        editor.state.selectedLinearElement?.initialState,
        "initialState must be set",
      );
      editor.setState({
        selectedLinearElement: {
          ...editor.state.selectedLinearElement,
          lastCommittedPoint: points[points.length - 1],
          selectedPointsIndices: [multiElement.points.length],
          initialState: {
            ...editor.state.selectedLinearElement.initialState,
            lastClickedPoint: multiElement.points.length,
          },
        },
      });
      editor.scene.mutateElement(
        multiElement,
        {
          points: [
            ...points,
            pointFrom<LocalPoint>(scenePointerX - rx, scenePointerY - ry),
          ],
        },
        { informMutation: false, isDragging: false },
      );
    }
  } else if (
    points.length > 2 &&
    lastCommittedPoint &&
    pointDistance(
      pointFrom(scenePointerX - rx, scenePointerY - ry),
      lastCommittedPoint,
    ) < LINE_CONFIRM_THRESHOLD
  ) {
    editor.scene.mutateElement(
      multiElement,
      {
        points: points.slice(0, -1),
      },
      { informMutation: false, isDragging: false },
    );
    const newLastIdx = multiElement.points.length - 1;
    editor.setState({
      selectedLinearElement: {
        ...selectedLinearElement,
        selectedPointsIndices: selectedLinearElement.selectedPointsIndices
          ? [
              ...new Set(
                selectedLinearElement.selectedPointsIndices.map((idx) =>
                  Math.min(idx, newLastIdx),
                ),
              ),
            ]
          : selectedLinearElement.selectedPointsIndices,
        lastCommittedPoint: multiElement.points[newLastIdx],
        initialState: {
          ...selectedLinearElement.initialState,
          lastClickedPoint: newLastIdx,
        },
      },
    });
  } else {
    invariant(
      editor.state.selectedLinearElement,
      "Expected selectedLinearElement to be set to operate on a linear element",
    );

    const newState = LinearElementEditor.handlePointerMove(
      event,
      editor as any,
      scenePointerX,
      scenePointerY,
      editor.state.selectedLinearElement,
    );
    if (newState) {
      editor.setState(newState);
    }
  }
};

/**
 * Suggests a binding target while hovering with the arrow tool.
 */
export const maybeSuggestBindingOnHover = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
) => {
  if (editor.state.activeTool.type !== "arrow" || editor.state.newElement) {
    return;
  }
  const { x: scenePointerX, y: scenePointerY } = viewportCoordsToSceneCoords(
    event,
    editor.state,
  );
  const scenePointer = pointFrom<GlobalPoint>(scenePointerX, scenePointerY);
  const hit = getHoveredElementForBinding(
    scenePointer,
    editor.scene.getNonDeletedElements(),
    editor.scene.getNonDeletedElementsMap(),
    maxBindingDistance_simple(editor.state.zoom),
  );
  const elementsMap = editor.scene.getNonDeletedElementsMap();
  if (hit && !isPointInElement(scenePointer, hit, elementsMap)) {
    editor.setState({
      suggestedBinding: {
        element: hit,
        midPoint: getSnapOutlineMidPoint(
          scenePointer,
          hit,
          elementsMap,
          editor.state.zoom,
        ),
      },
    });
  }
};

/**
 * Pointer-up while creating a linear element: either enter multi-point mode
 * (a click without a meaningful drag) or finalize the dragged element.
 */
export const finalizeLinearOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): void => {
  const { newElement, multiElement } = editor.state;

  if (!isLinearElement(newElement)) {
    return;
  }

  const pointerCoords = viewportCoordsToSceneCoords(event, editor.state);
  const sceneCoords = { x: pointerCoords.x, y: pointerCoords.y };

  const dragDistance =
    pointDistance(
      pointFrom(pointerCoords.x, pointerCoords.y),
      pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
    ) * editor.state.zoom.value;

  if (
    (!pointerDownState.drag.hasOccurred || dragDistance < MINIMUM_ARROW_SIZE) &&
    newElement &&
    !multiElement
  ) {
    // Movement out of commit area will create the point
    editor.setState({
      multiElement: newElement,
      newElement,
    });
  } else if (pointerDownState.drag.hasOccurred && !multiElement) {
    editor.store.scheduleCapture();

    editor.actionManager.executeAction(actionFinalize, "ui", {
      event,
      sceneCoords,
    });

    editor.setState({ suggestedBinding: null });
    if (!editor.isToolLocked()) {
      editor.setState((prevState) => ({
        newElement: null,
        activeTool: updateActiveTool(editor.state, {
          type: editor.state.preferredSelectionTool.type,
        }),
        selectedElementIds: makeNextSelectedElementIds(
          {
            ...prevState.selectedElementIds,
            [newElement.id]: true,
          },
          prevState,
        ),
        selectedLinearElement: new LinearElementEditor(
          newElement,
          editor.scene.getNonDeletedElementsMap(),
        ),
      }));
    } else {
      editor.setState({
        newElement: null,
      });
    }
    // so that the scene gets rendered again to display the newly drawn linear as well
    editor.scene.triggerUpdate();
  }

  // upstream reads `this.state` here, but React batching means it still sees
  // the values from before this handler's setState calls — so this block only
  // applies when multi-point mode was already active on entry
  if (
    newElement &&
    multiElement &&
    isLinearElement(newElement) &&
    editor.state.selectedLinearElement
  ) {
    editor.setState({
      selectedLinearElement: {
        ...editor.state.selectedLinearElement,
        lastCommittedPoint: multiElement.points[multiElement.points.length - 1],
      },
    });
  }
};
