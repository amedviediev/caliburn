import React from "react";

import { CURSOR_TYPE, KEYS, arrayToMap } from "@excalidraw/common";
import { getTransformHandles } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { TransformHandleType } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render } from "./test-utils";

const mouse = new Pointer("mouse");

const cursor = () => GlobalTestState.interactiveCanvas.style.cursor;

/**
 * A pointer move with the platform's primary modifier held. `Pointer` carries
 * `ctrlKey` only, and `KEYS.CTRL_OR_CMD` reads `metaKey` on darwin, so the
 * event is fired here with both.
 */
const moveWithModifier = (x: number, y: number) => {
  fireEvent.pointerMove(GlobalTestState.interactiveCanvas, {
    clientX: x,
    clientY: y,
    pointerType: "mouse",
    pointerId: 1,
    ctrlKey: true,
    metaKey: true,
  });
};

/** the client coords of the centre of a single element's transform handle */
const handleCenter = (
  element: ExcalidrawElement,
  handle: TransformHandleType,
): [number, number] => {
  const coords = getTransformHandles(
    element,
    h.state.zoom,
    arrayToMap(h.elements),
    "mouse",
    {},
  )[handle];
  if (!coords) {
    throw new Error(`no ${handle} transform handle`);
  }
  return [coords[0] + coords[2] / 2, coords[1] + coords[3] / 2];
};

const rectangle = () =>
  API.createElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  });

/**
 * A line selected by clicking it — which is what puts a `selectedLinearElement`
 * in the state, unlike a programmatic selection.
 */
const selectedLine = (points: LocalPoint[]) => {
  const line = API.createElement({
    type: "line",
    x: 100,
    y: 100,
    width: 100,
    height: 40,
    points,
  });
  API.setElements([line]);
  mouse.clickAt(100, 100);
  expect(h.state.selectedLinearElement?.elementId).toBe(line.id);
  return line;
};

/**
 * Points (100, 100) → (150, 140) → (200, 100): the two endpoints sit on the
 * top edge of the bounding box, so the band just above them is hit by the `n`
 * side-resizing handle and by the point handle both — which is what the
 * `hoverPointIndex` guard arbitrates.
 */
const THREE_POINT_LINE: LocalPoint[] = [
  pointFrom(0, 0),
  pointFrom(50, 40),
  pointFrom(100, 0),
];

describe("hover affordances", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw />);
  });

  describe("transform handle cursors", () => {
    it("shows the resizing cursor of each handle of a single selection", () => {
      const element = rectangle();
      API.setElements([element]);
      API.setSelectedElements([element]);

      mouse.moveTo(...handleCenter(element, "nw"));
      expect(cursor()).toBe("nwse-resize");

      mouse.moveTo(...handleCenter(element, "ne"));
      expect(cursor()).toBe("nesw-resize");

      mouse.moveTo(...handleCenter(element, "e"));
      expect(cursor()).toBe("ew-resize");

      mouse.moveTo(...handleCenter(element, "n"));
      expect(cursor()).toBe("ns-resize");

      mouse.moveTo(...handleCenter(element, "rotation"));
      expect(cursor()).toBe("grab");
    });

    it("shows the resizing cursor over the bounding box of a multi-selection", () => {
      const first = rectangle();
      const second = API.createElement({
        type: "rectangle",
        x: 300,
        y: 300,
        width: 100,
        height: 100,
      });
      API.setElements([first, second]);
      API.setSelectedElements([first, second]);

      // the common bounding box starts where the first element does, so its
      // nw handle is where that element's own would be
      mouse.moveTo(...handleCenter(first, "nw"));
      expect(cursor()).toBe("nwse-resize");
    });

    it("shows no resizing cursor while the element link selector is open", () => {
      const element = rectangle();
      API.setElements([element]);
      API.setSelectedElements([element]);
      API.setAppState({
        openDialog: {
          name: "elementLinkSelector",
          sourceElementId: element.id,
        },
      });

      mouse.moveTo(...handleCenter(element, "nw"));

      expect(cursor()).not.toBe("nwse-resize");
    });
  });

  describe("selected linear element", () => {
    it("hovering a point sets the pointer cursor and the hovered index", () => {
      selectedLine(THREE_POINT_LINE);

      mouse.moveTo(150, 140);

      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(1);
      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });

    it("hovering away from the points clears the hovered index", () => {
      selectedLine(THREE_POINT_LINE);

      mouse.moveTo(150, 140);
      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(1);

      mouse.moveTo(600, 600);
      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(-1);
    });

    it("hovering the midpoint of a two-point line sets its coords", () => {
      selectedLine([pointFrom(0, 0), pointFrom(100, 0)]);

      mouse.moveTo(150, 100);

      expect(
        h.state.selectedLinearElement?.segmentMidPointHoveredCoords,
      ).toEqual(pointFrom(150, 100));
      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });

    it("hovering a point wins over the transform handle underneath it", () => {
      selectedLine(THREE_POINT_LINE);

      // no point up here, so the `n` side-resizing handle takes the cursor
      mouse.moveTo(150, 99);
      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(-1);
      expect(cursor()).toBe("ns-resize");

      // the same band, but over the line's last point: the point wins
      mouse.moveTo(200, 99);
      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(2);
      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });

    it("does not arm a resize when the press lands on a hovered point", () => {
      selectedLine(THREE_POINT_LINE);

      // the same handle, no point under it: the press arms the resize
      mouse.moveTo(150, 99);
      mouse.downAt(150, 99);
      expect(h.state.resizingElement).not.toBe(null);
      mouse.upAt(150, 99);

      mouse.moveTo(200, 99);
      mouse.downAt(200, 99);
      expect(h.state.resizingElement).toBe(null);
      mouse.upAt(200, 99);
    });
  });

  describe("inside the line editor", () => {
    const enterLineEditor = () => {
      const line = selectedLine(THREE_POINT_LINE);
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.ENTER);
      });
      expect(h.state.selectedLinearElement?.isEditing).toBe(true);
      return line;
    };

    it("hovering a point sets the hovered index", () => {
      enterLineEditor();

      mouse.moveTo(150, 140);

      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(1);
      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });

    it("hovering a segment midpoint sets its coords", () => {
      enterLineEditor();

      // the midpoint of the first segment, (100, 100) → (150, 140)
      mouse.moveTo(125, 120);

      expect(
        h.state.selectedLinearElement?.segmentMidPointHoveredCoords,
      ).toEqual(pointFrom(125, 120));
      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });
  });

  // every case here moves with CTRL_OR_CMD held, which keeps the tail's own
  // move branch out of it (`!event[KEYS.CTRL_OR_CMD]`), so the cursor each
  // asserts is the hover helper's alone
  describe("the move branch", () => {
    it("hovering the element itself shows the move cursor", () => {
      selectedLine(THREE_POINT_LINE);

      // on the stroke, between a point and a segment midpoint
      moveWithModifier(140, 132);

      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(-1);
      expect(cursor()).toBe(CURSOR_TYPE.MOVE);
    });

    it("hovering inside the bounding box but off the stroke shows it too", () => {
      selectedLine(THREE_POINT_LINE);

      // inside the bounding box, ~27px off the nearest segment: the element
      // itself is missed, the selection's bounding box is not
      moveWithModifier(150, 105);

      expect(cursor()).toBe(CURSOR_TYPE.MOVE);
    });

    it("shows no move cursor for the lasso tool with nothing selected", () => {
      selectedLine(THREE_POINT_LINE);
      act(() => {
        h.app.setActiveTool({ type: "lasso" });
      });
      API.setAppState({ selectedElementIds: {} });
      expect(h.state.selectedLinearElement).not.toBe(null);

      moveWithModifier(140, 132);
      expect(cursor()).not.toBe(CURSOR_TYPE.MOVE);

      act(() => {
        h.app.setActiveTool({ type: "selection" });
      });
      API.setAppState({ selectedElementIds: {} });
      moveWithModifier(140, 132);
      expect(cursor()).toBe(CURSOR_TYPE.MOVE);
    });
  });

  describe("elbow arrows", () => {
    /** an elbow arrow routed (0, 0) → (125, 0) → (125, 200) → (250, 200) */
    const selectedElbowArrow = () => {
      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.moveTo(0, 0);
      mouse.click();
      mouse.moveTo(250, 200);
      mouse.click();
      expect(h.state.selectedLinearElement).not.toBe(null);
    };

    it("only the endpoints count as point handles", () => {
      selectedElbowArrow();

      // a routing corner: hovered, but no point handle to grab
      mouse.moveTo(125, 0);
      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(1);
      expect(cursor()).toBe(CURSOR_TYPE.MOVE);

      // the last point, which is one
      mouse.moveTo(250, 200);
      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(3);
      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });
  });

  describe("bound arrow focus point", () => {
    it("hovering it sets the hovered binding and the pointer cursor", () => {
      const rect = API.createElement({
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
          elementId: rect.id,
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      });
      API.setElements([rect, arrow]);
      mouse.clickAt(100, 150);
      expect(h.state.selectedLinearElement?.elementId).toBe(arrow.id);

      // the focus point: the rectangle's centre, where the binding is fixed
      mouse.moveTo(250, 150);

      expect(h.state.selectedLinearElement?.hoveredFocusPointBinding).toBe(
        "end",
      );
      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });
  });

  describe("while a multi-point element is being drawn", () => {
    it("does not hover the point the pointer is laying down", () => {
      UI.clickTool("line");
      mouse.reset();
      mouse.clickAt(100, 100);
      expect(h.state.multiElement).not.toBe(null);
      expect(h.state.selectedLinearElement).not.toBe(null);

      mouse.moveTo(200, 100);

      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(-1);
      expect(cursor()).toBe(CURSOR_TYPE.CROSSHAIR);
    });
  });
});
