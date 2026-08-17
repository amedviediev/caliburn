import { KEYS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { render } from "./test-utils";

const mouse = new Pointer("mouse");

const arrowById = (id: ExcalidrawElement["id"]) =>
  h.elements.find((element) => element.id === id) as ExcalidrawArrowElement;

/**
 * A rectangle at (200, 100)–(300, 200) and an arrow ending at its left edge,
 * bound to its centre — so the binding's focus point sits at (250, 150), far
 * enough from the arrow's own endpoint at (150, 150) for the indicator (and
 * with it the hit test) to be live.
 */
const selectedBoundArrow = () => {
  const rectangle = API.createElement({
    type: "rectangle",
    x: 200,
    y: 100,
    width: 100,
    height: 100,
  });
  const arrow = API.createElement({
    type: "arrow",
    x: 50,
    y: 150,
    width: 100,
    height: 0,
    points: [pointFrom(0, 0), pointFrom(100, 0)],
    endBinding: {
      elementId: rectangle.id,
      fixedPoint: [0.5, 0.5],
      mode: "orbit",
    },
  });
  API.setElements([rectangle, arrow]);
  mouse.clickAt(100, 150);
  expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);

  return { arrow, rectangle };
};

describe("focus point", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw />);
  });

  describe("pointer down", () => {
    it("arms the drag and takes the press away from element selection", () => {
      const { arrow, rectangle } = selectedBoundArrow();

      mouse.downAt(250, 150);

      expect(h.state.selectedLinearElement?.draggedFocusPointBinding).toBe(
        "end",
      );
      expect(h.state.selectedLinearElement?.hoveredFocusPointBinding).toBe(
        "end",
      );
      // the press landed on the focus point itself
      expect(h.state.selectedLinearElement?.pointerOffset.x).toBeCloseTo(0, 1);
      expect(h.state.selectedLinearElement?.pointerOffset.y).toBeCloseTo(0, 1);
      // the rectangle under the focus point stays unselected
      expect(h.state.selectedElementIds).toEqual({ [arrow.id]: true });
      expect(h.state.selectedElementIds[rectangle.id]).toBeUndefined();
    });

    it("records the arrow's other endpoint binding", () => {
      const start = API.createElement({
        type: "rectangle",
        x: 0,
        y: 100,
        width: 100,
        height: 100,
      });
      const end = API.createElement({
        type: "rectangle",
        x: 200,
        y: 100,
        width: 100,
        height: 100,
      });
      const arrow = API.createElement({
        type: "arrow",
        x: 100,
        y: 150,
        width: 100,
        height: 0,
        points: [pointFrom(0, 0), pointFrom(100, 0)],
        startBinding: {
          elementId: start.id,
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: {
          elementId: end.id,
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      });
      API.setElements([start, end, arrow]);
      mouse.clickAt(150, 150);
      expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);

      mouse.downAt(250, 150);

      expect(h.state.selectedLinearElement?.draggedFocusPointBinding).toBe(
        "end",
      );
      expect(
        h.state.selectedLinearElement?.initialState
          .arrowOtherEndpointInitialBinding,
      ).toEqual(arrow.startBinding);
    });

    it("leaves a press that misses the focus point on the selection path", () => {
      const { rectangle } = selectedBoundArrow();

      // the rectangle's top edge, nowhere near the focus point at its centre
      mouse.downAt(250, 100);

      expect(
        h.state.selectedLinearElement?.draggedFocusPointBinding ?? null,
      ).toBe(null);
      expect(h.state.selectedElementIds).toEqual({ [rectangle.id]: true });
    });
  });

  describe("drag", () => {
    it("moves the binding's fixed point and suspends point dragging", () => {
      const { arrow } = selectedBoundArrow();

      mouse.downAt(250, 150);
      mouse.moveTo(275, 175);

      expect(arrowById(arrow.id).endBinding?.fixedPoint[0]).toBeCloseTo(0.75);
      expect(arrowById(arrow.id).endBinding?.fixedPoint[1]).toBeCloseTo(0.75);
      expect(arrowById(arrow.id).endBinding?.mode).toBe("orbit");
      expect(h.state.selectedLinearElement?.selectedPointsIndices).toEqual([]);
      expect(h.state.selectedLinearElement?.isDragging).toBe(false);
      expect(h.state.selectedLinearElement?.initialState.lastClickedPoint).toBe(
        -1,
      );
    });

    it("switches the binding to inside mode while alt is held", () => {
      const { arrow } = selectedBoundArrow();

      mouse.downAt(250, 150);
      Keyboard.withModifierKeys({ alt: true }, () => {
        mouse.moveTo(275, 150);
      });

      expect(arrowById(arrow.id).endBinding?.mode).toBe("inside");
    });

    it("follows alt pressed and released without a pointer move", () => {
      const { arrow } = selectedBoundArrow();

      mouse.downAt(250, 150);
      mouse.moveTo(275, 150);

      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.keyDown(KEYS.ALT);
      });
      expect(arrowById(arrow.id).endBinding?.mode).toBe("inside");

      Keyboard.keyUp(KEYS.ALT);
      expect(arrowById(arrow.id).endBinding?.mode).toBe("orbit");
    });

    it("unbinds when the focus point is dragged off the shape", () => {
      const { arrow, rectangle } = selectedBoundArrow();

      mouse.downAt(250, 150);
      mouse.moveTo(500, 400);

      expect(arrowById(arrow.id).endBinding).toBe(null);
      expect(
        h.elements
          .find((element) => element.id === rectangle.id)
          ?.boundElements?.some(({ id }) => id === arrow.id) ?? false,
      ).toBe(false);
    });
  });

  describe("pointer up", () => {
    it("commits the new binding in a single history entry", () => {
      const { arrow, rectangle } = selectedBoundArrow();
      const undoStackSize = h.history.undoStack.length;

      mouse.downAt(250, 150);
      mouse.moveTo(275, 175);
      mouse.up();

      expect(h.state.selectedLinearElement?.draggedFocusPointBinding).toBe(
        null,
      );
      expect(
        h.state.selectedLinearElement?.initialState
          .arrowOtherEndpointInitialBinding,
      ).toBe(null);
      expect(arrowById(arrow.id).endBinding?.fixedPoint[0]).toBeCloseTo(0.75);
      expect(arrowById(arrow.id).endBinding?.fixedPoint[1]).toBeCloseTo(0.75);
      expect(
        h.elements
          .find((element) => element.id === rectangle.id)
          ?.boundElements?.some(({ id }) => id === arrow.id),
      ).toBe(true);
      expect(h.history.undoStack.length).toBe(undoStackSize + 1);

      Keyboard.undo();

      expect(arrowById(arrow.id).endBinding?.fixedPoint).toEqual([0.5, 0.5]);
    });

    it("restores the orbit bind mode", () => {
      selectedBoundArrow();
      API.setAppState({ bindMode: "inside" });

      mouse.clickAt(600, 600);

      expect(h.state.bindMode).toBe("orbit");
    });

    it("drops the linear editor when the release lands off a multi-selection", () => {
      const { arrow, rectangle } = selectedBoundArrow();
      API.setSelectedElements([arrow, rectangle]);
      API.setAppState({
        selectedLinearElement: h.state.selectedLinearElement,
      });

      // the rectangle, which is not the linear element the editor is on
      mouse.clickAt(210, 110);

      expect(h.state.selectedLinearElement).toBe(null);
    });
  });

  describe("elbow normalization on release", () => {
    it("renormalizes an elbow arrow bound to the dragged shape", () => {
      const start = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const end = API.createElement({
        type: "rectangle",
        x: 400,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([start, end]);

      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.moveTo(50, 50);
      mouse.click();
      mouse.moveTo(450, 50);
      mouse.click();

      const arrow = h.elements.at(-1) as NonDeleted<ExcalidrawArrowElement>;
      expect(arrow.startBinding?.elementId).toBe(start.id);
      expect(arrow.endBinding?.elementId).toBe(end.id);

      mouse.reset();
      API.setSelectedElements([start, arrow]);
      mouse.downAt(50, 0);
      mouse.moveTo(50, 300);

      // the drag itself keeps the route up to date, so the release's
      // normalization pass is what has to be observed
      const mutateElement = vi.spyOn(h.app.scene, "mutateElement");
      const routeAtRelease = arrowById(arrow.id).points;
      mouse.up();

      expect(mutateElement).toHaveBeenCalledWith(
        expect.objectContaining({ id: arrow.id }),
        {},
      );
      expect(arrowById(arrow.id).points).toEqual(routeAtRelease);
    });

    it("normalizes the selected elbow arrow's own route", () => {
      const rectangle = API.createElement({
        type: "rectangle",
        x: 300,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([rectangle]);

      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.moveTo(0, 50);
      mouse.click();
      mouse.moveTo(150, 50);
      mouse.click();

      const arrow = h.elements.at(-1) as ExcalidrawArrowElement;
      expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);
      expect(h.state.selectedLinearElement?.isEditing).toBe(false);

      // drag the free endpoint over the rectangle, where the drag snaps it to
      // the outline and the release recomputes the route from the binding
      mouse.reset();
      mouse.downAt(150, 50);
      mouse.moveTo(340, 40);

      const mutateElement = vi.spyOn(h.app.scene, "mutateElement");
      const routeAtRelease = arrowById(arrow.id).points;
      mouse.up();

      expect(mutateElement).toHaveBeenCalledWith(
        expect.objectContaining({ id: arrow.id }),
        {},
      );
      expect(arrowById(arrow.id).points).toEqual(routeAtRelease);
    });
  });
});
