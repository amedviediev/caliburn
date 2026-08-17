import {
  ARROW_TYPE,
  CURSOR_TYPE,
  KEYS,
  LINE_CONFIRM_THRESHOLD,
  MINIMUM_ARROW_SIZE,
  ROUNDNESS,
  getGridPoint,
  invariant,
  isShallowEqual,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  LinearElementEditor,
  bindOrUnbindBindingElement,
  getBindingStrategyForDraggingBindingElementEndpoints,
  getHoveredElementForBinding,
  getSnapOutlineMidPoint,
  handleFocusPointHover,
  hitElementItself,
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
import type {
  ExcalidrawArrowElement,
  ExcalidrawLinearElement,
} from "@excalidraw/element/types";

import { actionFinalize } from "./actions/actionFinalize";
import { getEffectiveGridSize } from "./create-interaction";
import { getElementHitThreshold, hitElement } from "./selection-interaction";

import { getTopLayerFrameAtSceneCoords } from "./text-interaction";

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

    const topLayerFrame = getTopLayerFrameAtSceneCoords(editor, {
      x: gridX,
      y: gridY,
    });

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
            frameId: topLayerFrame ? topLayerFrame.id : null,
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
            frameId: topLayerFrame ? topLayerFrame.id : null,
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
  if (!linearElementEditor) {
    return false;
  }

  const pointerCoords = pointerDownState.lastCoords;
  const elementsMap = editor.scene.getNonDeletedElementsMap();

  // upstream runs this one ahead of the eraser/laser/sketch branches, as its
  // own `if` on the move handler; none of those tools can be active while an
  // elbow arrow's segment is under the pointer, so it rides along here with
  // the rest of the linear-drag family
  if (
    linearElementEditor.elbowed &&
    linearElementEditor.initialState.segmentMidpoint.index
  ) {
    const [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      event[KEYS.CTRL_OR_CMD] ? null : getEffectiveGridSize(editor),
    );

    let index = linearElementEditor.initialState.segmentMidpoint.index;
    if (index < 0) {
      const nextCoords = LinearElementEditor.getSegmentMidpointHitCoords(
        {
          ...linearElementEditor,
          segmentMidPointHoveredCoords: null,
        },
        { x: gridX, y: gridY },
        editor.state,
        elementsMap,
      );
      index = nextCoords
        ? LinearElementEditor.getSegmentMidPointIndex(
            linearElementEditor,
            editor.state,
            nextCoords,
            elementsMap,
          )
        : -1;
    }

    const ret = LinearElementEditor.moveFixedSegment(
      linearElementEditor,
      index,
      gridX,
      gridY,
      editor.scene,
    );

    editor.setState({
      selectedLinearElement: {
        ...linearElementEditor,
        isDragging: true,
        segmentMidPointHoveredCoords: ret.segmentMidPointHoveredCoords,
        initialState: ret.initialState,
      },
    });
    return true;
  }

  // dragging a segment midpoint splits the segment: the point is added on
  // the first move past the threshold, and the drag then carries it
  if (
    LinearElementEditor.shouldAddMidpoint(
      linearElementEditor,
      pointerCoords,
      editor.state,
      elementsMap,
    )
  ) {
    const ret = LinearElementEditor.addMidpoint(
      linearElementEditor,
      pointerCoords,
      editor as any,
      !event[KEYS.CTRL_OR_CMD],
      editor.scene,
    );
    if (!ret) {
      return true;
    }

    if (editor.state.selectedLinearElement) {
      editor.setState({
        selectedLinearElement: {
          ...editor.state.selectedLinearElement,
          initialState: ret.pointerDownState,
          selectedPointsIndices: ret.selectedPointsIndices,
          segmentMidPointHoveredCoords: null,
          isDragging: true,
        },
      });
    }

    return true;
  } else if (
    linearElementEditor.initialState.segmentMidpoint.value !== null &&
    !linearElementEditor.initialState.segmentMidpoint.added
  ) {
    // the midpoint was grabbed but the drag hasn't cleared the threshold yet
    return true;
  }

  if (linearElementEditor.initialState.lastClickedPoint === -1) {
    return false;
  }

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

    // NOTE: Optimize setState calls because it
    // affects history and performance
    if (
      newState.suggestedBinding !== editor.state.suggestedBinding ||
      !isShallowEqual(
        newState.selectedLinearElement?.selectedPointsIndices ?? [],
        editor.state.selectedLinearElement?.selectedPointsIndices ?? [],
      ) ||
      newState.selectedLinearElement?.hoverPointIndex !==
        editor.state.selectedLinearElement?.hoverPointIndex ||
      newState.selectedLinearElement?.customLineAngle !==
        editor.state.selectedLinearElement?.customLineAngle ||
      // upstream reads `this.state.selectedLinearElement.isDragging` here,
      // non-optionally; `linearElementEditor` is that same object, taken off
      // the state at the top of this function and never replaced since
      linearElementEditor.isDragging !==
        newState.selectedLinearElement?.isDragging ||
      editor.state.selectedLinearElement?.initialState?.altFocusPoint !==
        newState.selectedLinearElement?.initialState?.altFocusPoint
    ) {
      editor.setState(newState);
    }

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
      // upstream wraps the setState above in `flushSync` so the scheduled
      // capture commits before the uncommitted trailing point is added
      editor.flushCommits();
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
 * upstream `App.handleHoverSelectedLinearElement` — the hover affordance of a
 * selected linear element: the POINTER cursor over a point handle or a segment
 * midpoint, the MOVE cursor over the element itself, and the
 * `hoverPointIndex` / `segmentMidPointHoveredCoords` the interactive renderer
 * draws the handles from.
 */
export const handleHoverSelectedLinearElement = (
  editor: CaliburnEditorComponent,
  linearElementEditor: LinearElementEditor,
  scenePointerX: number,
  scenePointerY: number,
) => {
  const elementsMap = editor.scene.getNonDeletedElementsMap();

  const element = LinearElementEditor.getElement(
    linearElementEditor.elementId,
    elementsMap,
  );

  if (!element) {
    return;
  }
  if (editor.state.selectedLinearElement) {
    let hoverPointIndex = -1;
    let segmentMidPointHoveredCoords = null;
    if (
      hitElementItself({
        point: pointFrom(scenePointerX, scenePointerY),
        element,
        elementsMap,
        threshold: getElementHitThreshold(editor, element),
      })
    ) {
      hoverPointIndex = LinearElementEditor.getPointIndexUnderCursor(
        element,
        elementsMap,
        editor.state.zoom,
        scenePointerX,
        scenePointerY,
      );
      segmentMidPointHoveredCoords =
        LinearElementEditor.getSegmentMidpointHitCoords(
          linearElementEditor,
          { x: scenePointerX, y: scenePointerY },
          editor.state,
          editor.scene.getNonDeletedElementsMap(),
        );
      const isHoveringAPointHandle = isElbowArrow(element)
        ? hoverPointIndex === 0 || hoverPointIndex === element.points.length - 1
        : hoverPointIndex >= 0;
      if (isHoveringAPointHandle || segmentMidPointHoveredCoords) {
        editor.cursor.set(CURSOR_TYPE.POINTER);
      } else if (hitElement(editor, scenePointerX, scenePointerY, element)) {
        if (
          // Elbow arrows can only be moved when unconnected
          !isElbowArrow(element) ||
          !(element.startBinding || element.endBinding)
        ) {
          if (
            editor.state.activeTool.type !== "lasso" ||
            Object.keys(editor.state.selectedElementIds).length > 0
          ) {
            editor.cursor.set(CURSOR_TYPE.MOVE);
          }
        }
      }
    } else if (hitElement(editor, scenePointerX, scenePointerY, element)) {
      if (
        // Elbow arrow can only be moved when unconnected
        !isElbowArrow(element) ||
        !(element.startBinding || element.endBinding)
      ) {
        if (
          editor.state.activeTool.type !== "lasso" ||
          Object.keys(editor.state.selectedElementIds).length > 0
        ) {
          editor.cursor.set(CURSOR_TYPE.MOVE);
        }
      }
    }

    if (
      editor.state.selectedLinearElement.hoverPointIndex !== hoverPointIndex
    ) {
      editor.setState({
        selectedLinearElement: {
          ...editor.state.selectedLinearElement,
          hoverPointIndex,
        },
      });
    }

    if (
      !LinearElementEditor.arePointsEqual(
        editor.state.selectedLinearElement.segmentMidPointHoveredCoords,
        segmentMidPointHoveredCoords,
      )
    ) {
      editor.setState({
        selectedLinearElement: {
          ...editor.state.selectedLinearElement,
          segmentMidPointHoveredCoords,
        },
      });
    }

    // Check for focus point hover
    let hoveredFocusPointBinding: "start" | "end" | null = null;
    const arrow = element as any;
    if (arrow.startBinding || arrow.endBinding) {
      hoveredFocusPointBinding = handleFocusPointHover(
        element as ExcalidrawArrowElement,
        scenePointerX,
        scenePointerY,
        editor.scene,
        editor.state,
      );
    }

    if (
      editor.state.selectedLinearElement.hoveredFocusPointBinding !==
      hoveredFocusPointBinding
    ) {
      editor.setState({
        selectedLinearElement: {
          ...editor.state.selectedLinearElement,
          isDragging: false,
          hoveredFocusPointBinding,
        },
      });
    }

    // Set cursor to pointer when hovering over a focus point
    if (hoveredFocusPointBinding) {
      editor.cursor.set(CURSOR_TYPE.POINTER);
    }
  } else {
    editor.cursor.set(CURSOR_TYPE.AUTO);
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

// Handle end of dragging a point of a linear element, might close a loop
// and sets binding element
export const handleLinearEditorPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
) => {
  const sceneCoords = viewportCoordsToSceneCoords(event, editor.state);

  if (
    editor.state.selectedLinearElement?.isEditing &&
    !editor.state.newElement &&
    editor.state.selectedLinearElement.draggedFocusPointBinding === null
  ) {
    if (
      !pointerDownState.boxSelection.hasOccurred &&
      pointerDownState.hit?.element?.id !==
        editor.state.selectedLinearElement.elementId &&
      editor.state.selectedLinearElement.draggedFocusPointBinding === null
    ) {
      editor.actionManager.executeAction(actionFinalize);
    } else {
      const editingLinearElement = LinearElementEditor.handlePointerUp(
        event,
        editor.state.selectedLinearElement,
        editor.state,
        editor.scene,
      );
      editor.actionManager.executeAction(actionFinalize, "ui", {
        event,
        sceneCoords,
      });
      if (editingLinearElement !== editor.state.selectedLinearElement) {
        editor.setState({
          selectedLinearElement: editingLinearElement,
          suggestedBinding: null,
        });
      }
    }
  } else if (editor.state.selectedLinearElement) {
    if (editor.state.selectedLinearElement.isDragging) {
      editor.setState({
        selectedLinearElement: {
          ...editor.state.selectedLinearElement,
          isDragging: false,
        },
      });
      editor.actionManager.executeAction(actionFinalize, "ui", {
        event,
        sceneCoords,
      });
    }
  }
};
