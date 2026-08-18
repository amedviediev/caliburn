import { BIND_MODE_TIMEOUT, invariant } from "@excalidraw/common";
import {
  LinearElementEditor,
  doBoundsIntersect,
  getElementBounds,
  getHoveredElementForBinding,
  isElbowArrow,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { CaliburnEditorComponent } from "./editor.component";

/**
 * The delayed bind mode behind the `COMPLEX_BINDINGS` feature flag: hovering
 * a bindable element with an arrow endpoint for `BIND_MODE_TIMEOUT` promotes
 * the binding from orbiting the outline to landing inside it, and ALT skips
 * the mode entirely. Upstream keeps these as `App` members; every call site
 * carries the flag gate, as upstream's do.
 */
export class CaliburnBindMode {
  constructor(private app: CaliburnEditorComponent) {}

  handleSkipBindMode() {
    if (
      this.app.state.selectedLinearElement?.initialState &&
      !this.app.state.selectedLinearElement.initialState.arrowStartIsInside
    ) {
      invariant(
        this.app.lastPointerMoveCoords,
        "Missing last pointer move coords when changing bind skip mode for arrow start",
      );
      const elementsMap = this.app.scene.getNonDeletedElementsMap();
      const hoveredElement = getHoveredElementForBinding(
        pointFrom<GlobalPoint>(
          this.app.lastPointerMoveCoords.x,
          this.app.lastPointerMoveCoords.y,
        ),
        this.app.scene.getNonDeletedElements(),
        elementsMap,
      );
      const element = LinearElementEditor.getElement(
        this.app.state.selectedLinearElement.elementId,
        elementsMap,
      );

      if (
        element?.startBinding &&
        hoveredElement?.id === element.startBinding.elementId
      ) {
        this.app.setState({
          selectedLinearElement: {
            ...this.app.state.selectedLinearElement,
            initialState: {
              ...this.app.state.selectedLinearElement.initialState,
              arrowStartIsInside: true,
            },
          },
        });
      }
    }

    if (this.app.state.bindMode === "orbit") {
      if (this.app.bindModeHandler) {
        clearTimeout(this.app.bindModeHandler);
        this.app.bindModeHandler = null;
      }

      // PERF: It's okay since it's a single trigger from a key handler
      // or single call from pointer move handler because the bindMode check
      // will not pass the second time
      this.app.setState({
        bindMode: "skip",
      });

      if (
        this.app.lastPointerMoveCoords &&
        this.app.state.selectedLinearElement?.selectedPointsIndices &&
        this.app.state.selectedLinearElement?.selectedPointsIndices.length
      ) {
        const { x, y } = this.app.lastPointerMoveCoords;
        const event =
          this.app.lastPointerMoveEvent ?? this.app.lastPointerDownEvent;
        invariant(event, "Last event must exist");
        const deltaX = x - this.app.state.selectedLinearElement.pointerOffset.x;
        const deltaY = y - this.app.state.selectedLinearElement.pointerOffset.y;
        const newState = this.app.state.multiElement
          ? LinearElementEditor.handlePointerMove(
              event,
              this.app as any,
              deltaX,
              deltaY,
              this.app.state.selectedLinearElement,
            )
          : LinearElementEditor.handlePointDragging(
              event,
              this.app as any,
              deltaX,
              deltaY,
              this.app.state.selectedLinearElement,
            );
        if (newState) {
          this.app.setState(newState);
        }
      }
    }
  }

  resetDelayedBindMode() {
    if (this.app.bindModeHandler) {
      clearTimeout(this.app.bindModeHandler);
      this.app.bindModeHandler = null;
    }

    if (this.app.state.bindMode !== "orbit") {
      // We need this iteration to complete binding and change
      // back to orbit mode after that
      setTimeout(() =>
        this.app.setState({
          bindMode: "orbit",
        }),
      );
    }
  }

  private previousHoveredBindableElement: NonDeletedExcalidrawElement | null =
    null;

  handleDelayedBindModeChange(
    arrow: ExcalidrawArrowElement,
    hoveredElement: NonDeletedExcalidrawElement | null,
  ) {
    if (arrow.isDeleted || isElbowArrow(arrow)) {
      return;
    }

    const effector = () => {
      this.app.bindModeHandler = null;

      invariant(
        this.app.lastPointerMoveCoords,
        "Expected lastPointerMoveCoords to be set",
      );

      if (!this.app.state.multiElement) {
        if (
          !this.app.state.selectedLinearElement ||
          !this.app.state.selectedLinearElement.selectedPointsIndices ||
          !this.app.state.selectedLinearElement.selectedPointsIndices.length
        ) {
          return;
        }

        const startDragged =
          this.app.state.selectedLinearElement.selectedPointsIndices.includes(
            0,
          );
        const endDragged =
          this.app.state.selectedLinearElement.selectedPointsIndices.includes(
            arrow.points.length - 1,
          );

        // Check if the whole arrow is dragged by selecting all endpoints
        if ((!startDragged && !endDragged) || (startDragged && endDragged)) {
          return;
        }
      }

      const { x, y } = this.app.lastPointerMoveCoords;
      const hoveredElement = getHoveredElementForBinding(
        pointFrom<GlobalPoint>(x, y),
        this.app.scene.getNonDeletedElements(),
        this.app.scene.getNonDeletedElementsMap(),
      );

      if (hoveredElement && this.app.state.bindMode !== "skip") {
        invariant(
          this.app.state.selectedLinearElement?.elementId === arrow.id,
          "The selectedLinearElement is expected to not change while a bind mode timeout is ticking",
        );

        // Once the start is set to inside binding, it remains so
        const arrowStartIsInside =
          this.app.state.selectedLinearElement.initialState
            .arrowStartIsInside ||
          arrow.startBinding?.elementId === hoveredElement.id;

        // Change the global binding mode
        invariant(
          this.app.state.selectedLinearElement,
          "this.state.selectedLinearElement must exist",
        );

        this.app.setState({
          bindMode: "inside",
          selectedLinearElement: {
            ...this.app.state.selectedLinearElement,
            initialState: {
              ...this.app.state.selectedLinearElement.initialState,
              arrowStartIsInside,
            },
          },
        });

        const event =
          this.app.lastPointerMoveEvent ?? this.app.lastPointerDownEvent;
        invariant(event, "Last event must exist");
        const deltaX = x - this.app.state.selectedLinearElement.pointerOffset.x;
        const deltaY = y - this.app.state.selectedLinearElement.pointerOffset.y;
        const newState = this.app.state.multiElement
          ? LinearElementEditor.handlePointerMove(
              event,
              this.app as any,
              deltaX,
              deltaY,
              this.app.state.selectedLinearElement,
            )
          : LinearElementEditor.handlePointDragging(
              event,
              this.app as any,
              deltaX,
              deltaY,
              this.app.state.selectedLinearElement,
            );
        if (newState) {
          this.app.setState(newState);
        }
      }
    };

    let isOverlapping = false;
    if (this.app.state.selectedLinearElement?.selectedPointsIndices) {
      const elementsMap = this.app.scene.getNonDeletedElementsMap();
      const startDragged =
        this.app.state.selectedLinearElement.selectedPointsIndices.includes(0);
      const endDragged =
        this.app.state.selectedLinearElement.selectedPointsIndices.includes(
          arrow.points.length - 1,
        );
      const startElement = startDragged
        ? hoveredElement
        : arrow.startBinding && elementsMap.get(arrow.startBinding.elementId);
      const endElement = endDragged
        ? hoveredElement
        : arrow.endBinding && elementsMap.get(arrow.endBinding.elementId);
      const startBounds =
        startElement && getElementBounds(startElement, elementsMap);
      const endBounds = endElement && getElementBounds(endElement, elementsMap);
      isOverlapping = !!(
        startBounds &&
        endBounds &&
        startElement.id !== endElement.id &&
        doBoundsIntersect(startBounds, endBounds)
      );
    }

    const startDragged =
      this.app.state.selectedLinearElement?.selectedPointsIndices?.includes(0);
    const endDragged =
      this.app.state.selectedLinearElement?.selectedPointsIndices?.includes(
        arrow.points.length - 1,
      );
    const currentBinding = startDragged
      ? "startBinding"
      : endDragged
      ? "endBinding"
      : null;
    const otherBinding = startDragged
      ? "endBinding"
      : endDragged
      ? "startBinding"
      : null;
    const isAlreadyInsideBindingToSameElement =
      (otherBinding &&
        arrow[otherBinding]?.mode === "inside" &&
        arrow[otherBinding]?.elementId === hoveredElement?.id) ||
      (currentBinding &&
        arrow[currentBinding]?.mode === "inside" &&
        hoveredElement?.id === arrow[currentBinding]?.elementId);

    if (
      currentBinding &&
      otherBinding &&
      arrow[currentBinding]?.mode === "inside" &&
      hoveredElement?.id !== arrow[currentBinding]?.elementId &&
      arrow[otherBinding]?.elementId !== arrow[currentBinding]?.elementId
    ) {
      // Update binding out of place to orbit mode
      this.app.scene.mutateElement(
        arrow,
        {
          [currentBinding]: {
            ...arrow[currentBinding],
            mode: "orbit",
          },
        },
        {
          informMutation: false,
          isDragging: true,
        },
      );
    }

    if (
      !hoveredElement ||
      (this.previousHoveredBindableElement &&
        hoveredElement.id !== this.previousHoveredBindableElement.id)
    ) {
      // Clear the timeout if we're not hovering a bindable
      if (this.app.bindModeHandler) {
        clearTimeout(this.app.bindModeHandler);
        this.app.bindModeHandler = null;
      }

      // Clear the inside binding mode too
      if (this.app.state.bindMode === "inside") {
        this.app.setState({
          bindMode: "orbit",
        });
      }

      this.previousHoveredBindableElement = null;
    } else if (
      !this.app.bindModeHandler &&
      (!this.app.state.newElement || !arrow.startBinding || isOverlapping) &&
      !isAlreadyInsideBindingToSameElement
    ) {
      // We are hovering a bindable element
      this.app.bindModeHandler = setTimeout(effector, BIND_MODE_TIMEOUT);
    }

    this.previousHoveredBindableElement = hoveredElement;
  }
}
