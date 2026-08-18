import { KEYS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import "@excalidraw/utils/test-utils";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render } from "./test-utils";

const mouse = new Pointer("mouse");

const arrowById = (id: ExcalidrawElement["id"]) =>
  h.elements.find((element) => element.id === id) as ExcalidrawArrowElement;

const elbowArrowById = (id: ExcalidrawElement["id"]) =>
  arrowById(id) as ExcalidrawElbowArrowElement;

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

    it("follows the binding toggle pressed and released mid-drag", () => {
      const { arrow } = selectedBoundArrow();

      mouse.downAt(250, 150);
      mouse.moveTo(275, 150);
      expect(arrowById(arrow.id).endBinding).not.toBe(null);

      // ctrl/cmd turns binding off, which the drag in flight has to follow
      fireEvent.keyDown(document, {
        key: KEYS.CTRL_OR_CMD === "metaKey" ? "Meta" : "Control",
        ctrlKey: true,
        metaKey: true,
      });
      expect(arrowById(arrow.id).endBinding).toBe(null);

      fireEvent.keyUp(document, {
        key: KEYS.CTRL_OR_CMD === "metaKey" ? "Meta" : "Control",
        ctrlKey: false,
        metaKey: false,
      });
      expect(arrowById(arrow.id).endBinding).not.toBe(null);
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

    it("disarms the drag before a short-circuiting tool ends the release", () => {
      selectedBoundArrow();

      mouse.downAt(250, 150);
      mouse.moveTo(275, 175);
      const editor = h.state.selectedLinearElement;
      // the laser drops the editor along with the selection, so it is put
      // back: the release then has both a live focus-point drag and a tool
      // whose branch returns early, which is what upstream's order — the
      // linear-editor block first, the tool branches after — is about
      act(() => {
        h.app.setActiveTool({ type: "laser" });
      });
      API.setAppState({ selectedLinearElement: editor });
      mouse.up();

      expect(h.state.selectedLinearElement?.draggedFocusPointBinding).toBe(
        null,
      );
    });

    it("restores the orbit bind mode", () => {
      selectedBoundArrow();
      API.setAppState({ bindMode: "inside" });

      mouse.clickAt(600, 600);

      expect(h.state.bindMode).toBe("orbit");
    });

    it("restores the orbit bind mode whichever gesture ends", () => {
      // a shape drawn with the rectangle tool
      API.setAppState({ bindMode: "inside" });
      UI.clickTool("rectangle");
      mouse.downAt(400, 400);
      mouse.moveTo(500, 500);
      mouse.up();
      expect(h.state.bindMode).toBe("orbit");

      // an arrow, whose release goes through the linear finalize instead
      API.setAppState({ bindMode: "inside" });
      UI.clickTool("arrow");
      mouse.downAt(600, 400);
      mouse.moveTo(700, 500);
      mouse.up();
      expect(h.state.bindMode).toBe("orbit");

      // a laser stroke, whose release returns before every branch above
      API.setAppState({ bindMode: "inside" });
      act(() => {
        h.app.setActiveTool({ type: "laser" });
      });
      mouse.downAt(300, 300);
      mouse.moveTo(350, 350);
      mouse.up();
      expect(h.state.bindMode).toBe("orbit");

      // a plain click on an element
      act(() => {
        h.app.setActiveTool({ type: "selection" });
      });
      API.setAppState({ bindMode: "inside" });
      mouse.clickAt(450, 400);
      expect(h.state.bindMode).toBe("orbit");

      // a click that deselects, which ends the release early too
      API.setAppState({ bindMode: "inside" });
      mouse.clickAt(900, 900);
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

  describe("bind mode", () => {
    it("returns to orbit when a link click ends the release", () => {
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      const linked = {
        ...API.createElement({
          type: "rectangle",
          x: 100,
          y: 100,
          width: 100,
          height: 100,
        }),
        link: "https://example.com",
      };
      API.setElements([linked]);
      (h.app.editorInterface as { isTouchScreen: boolean }).isTouchScreen =
        true;
      API.setAppState({ bindMode: "inside" });

      // the link icon, at the element's top-right corner
      mouse.clickAt(208, 92);

      expect(open).toHaveBeenCalled();
      expect(h.state.bindMode).toBe("orbit");
    });

    it("returns to orbit when a key release leaves binding disabled", () => {
      selectedBoundArrow();
      API.setAppState({ bindMode: "inside", isBindingEnabled: false });

      Keyboard.keyUp("a");

      expect(h.state.bindMode).toBe("orbit");
    });
  });

  describe("elbow normalization on release", () => {
    it("renormalizes an elbow arrow bound to the dragged shape", () => {
      UI.createElement("rectangle", {
        x: -100,
        y: -50,
        width: 100,
        height: 100,
      });
      const second = UI.createElement("rectangle", {
        x: 200,
        y: 150,
        width: 100,
        height: 100,
      });

      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.moveTo(0, 0);
      mouse.click();
      mouse.moveTo(200, 200);
      mouse.click();

      // pin the middle segment, so the route carries a fixed segment the move
      // below makes redundant
      mouse.reset();
      mouse.moveTo(100, 100);
      mouse.down();
      mouse.moveTo(115, 100);
      mouse.up();

      const arrow = h.elements.find(
        (element) => element.type === "arrow",
      ) as NonDeleted<ExcalidrawElbowArrowElement>;
      expect(arrow.fixedSegments).toHaveLength(1);
      expect(arrow.points).toHaveLength(4);

      // with no linear editor on the arrow, the indirect pass is the only
      // normalization the release can run
      API.setAppState({ selectedLinearElement: null });
      API.setSelectedElements([second.get() as NonDeletedExcalidrawElement]);

      // dragging the bound shape up flattens the pinned segment, and the drag
      // itself keeps routing around it
      mouse.reset();
      mouse.downAt(250, 150);
      mouse.moveTo(250, -50);
      expect(arrowById(arrow.id).points).toHaveLength(4);

      mouse.up();

      expect(arrowById(arrow.id).points).toHaveLength(2);
      expect(elbowArrowById(arrow.id).fixedSegments).toBe(null);
    });

    it("normalizes the selected elbow arrow's own route", () => {
      const arrow = API.createElement({
        type: "arrow",
        elbowed: true,
        x: 100,
        y: 100,
        width: 200,
        height: 0,
        // a redundant collinear midpoint, which a normalization pass drops
        points: [pointFrom(0, 0), pointFrom(100, 0), pointFrom(200, 0)],
      });
      API.setElements([arrow]);

      // the first click puts the linear editor on the arrow, the second is
      // the release the normalization pass runs on
      mouse.clickAt(200, 100);
      expect(h.state.selectedLinearElement?.elbowed).toBe(true);
      expect(arrowById(arrow.id).points).toHaveLength(3);

      mouse.clickAt(200, 100);

      expect(arrowById(arrow.id).points).toCloselyEqualPoints([
        [0, 0],
        [200, 0],
      ]);
    });
  });
});
