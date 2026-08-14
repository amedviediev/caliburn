import React from "react";

import { ROUNDNESS, arrayToMap, reseed } from "@excalidraw/common";
import {
  getElementBounds,
  getElementLineSegments,
  getElementsWithinSelection,
} from "@excalidraw/element";
import { pointFrom, pointRotateRads, type LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import {
  render,
  fireEvent,
  assertSelectedElements,
  unmountComponent,
} from "./test-utils";

unmountComponent();

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const mouse = new Pointer("mouse");

const getOutlineBounds = (element: ReturnType<typeof API.createElement>) => {
  const sceneElement = API.getElement(element);
  const elementsMap = h.scene.getNonDeletedElementsMap();
  const points = getElementLineSegments(sceneElement, elementsMap).flat();

  return [
    Math.min(...points.map((point) => point[0])),
    Math.min(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[0])),
    Math.max(...points.map((point) => point[1])),
  ] as const;
};

describe("box-selection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("should allow adding to selection via box-select when holding shift", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      width: 50,
      height: 50,
    });

    API.setElements([rect1, rect2]);

    mouse.downAt(175, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(85, 70);
    mouse.up();

    assertSelectedElements([rect2.id]);

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.downAt(75, -20);
      mouse.move(-1000, -1000);
      mouse.moveTo(-15, 70);
      mouse.up();
    });

    assertSelectedElements([rect2.id, rect1.id]);
  });

  it("should (de)select element when box-selecting over and out while not holding shift", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    mouse.downAt(75, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(-15, 70);

    assertSelectedElements([rect1.id]);

    mouse.moveTo(100, -100);

    assertSelectedElements([]);

    mouse.up();

    assertSelectedElements([]);
  });

  it("should not select an element when the selection box only partially overlaps it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    mouse.downAt(25, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(75, 70);
    mouse.up();

    assertSelectedElements([]);
  });
});

describe("box-selection overlap mode", () => {
  const boxSelect = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    mouse.downAt(startX, startY);
    mouse.move(-1000, -1000);
    mouse.moveTo(endX, endY);
    mouse.up();
  };

  const boxSelectTopLeftAabbCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneElement, elementsMap);

    boxSelect(x1 + 2, y1 + 2, x1 + 12, y1 + 12);
  };

  const boxSelectTopRightAabbCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [, y1, x2] = getElementBounds(sceneElement, elementsMap);

    boxSelect(x2 - 12, y1 + 2, x2 - 2, y1 + 12);
  };

  const boxSelectTopLeftRotatedLocalBoundsCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1, x2, y2] = getElementBounds(sceneElement, elementsMap, true);
    const center = pointFrom((x1 + x2) / 2, (y1 + y2) / 2);
    const [cornerX, cornerY] = pointRotateRads(
      pointFrom(x1, y1),
      center,
      sceneElement.angle,
    );

    boxSelect(cornerX - 4, cornerY - 4, cornerX + 4, cornerY + 4);
  };

  beforeEach(async () => {
    await render(
      <Excalidraw
        initialData={{ appState: { boxSelectionMode: "overlap" } }}
      />,
    );
  });

  it("should select an element when the selection box partially overlaps it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, -20, 75, 70);

    assertSelectedElements([rect1.id]);
  });

  it("should select the whole group when overlapping one group member", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });

    API.setElements([rect1, rect2]);

    boxSelect(25, -20, 75, 70);

    assertSelectedElements([rect1.id, rect2.id]);
    expect(h.state.selectedGroupIds).toEqual({ A: true });
  });

  it("should return all group elements when overlapping one group member", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      id: "rect1",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      id: "rect2",
      x: 100,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      id: "rect3",
      x: 200,
      y: 0,
      width: 50,
      height: 50,
    });
    const selection = API.createElement({
      type: "rectangle",
      x: 125,
      y: -10,
      width: 10,
      height: 70,
    });
    const elements = [rect1, rect2, rect3];

    expect(
      getElementsWithinSelection(
        elements,
        selection,
        arrayToMap([...elements, selection]),
        false,
        "overlap",
      ).map((element) => element.id),
    ).toEqual([rect1.id, rect2.id]);
  });

  it("should retain nested and interleaved group element order", () => {
    const outerNested1 = API.createElement({
      type: "rectangle",
      id: "outerNested1",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["inner", "outer"],
    });
    const other1 = API.createElement({
      type: "rectangle",
      id: "other1",
      x: 70,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["other"],
    });
    const outerOnly = API.createElement({
      type: "rectangle",
      id: "outerOnly",
      x: 140,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["outer"],
    });
    const other2 = API.createElement({
      type: "rectangle",
      id: "other2",
      x: 210,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["other"],
    });
    const outerNested2 = API.createElement({
      type: "rectangle",
      id: "outerNested2",
      x: 280,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["inner", "outer"],
    });
    const selection = API.createElement({
      type: "rectangle",
      x: 295,
      y: -10,
      width: 10,
      height: 70,
    });
    const elements = [outerNested1, other1, outerOnly, other2, outerNested2];

    expect(
      getElementsWithinSelection(
        elements,
        selection,
        arrayToMap([...elements, selection]),
        false,
        "overlap",
      ).map((element) => element.id),
    ).toEqual([outerNested1.id, outerOnly.id, outerNested2.id]);
  });

  it("should not select a transparent rectangle when the selection box stays inside it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, 25, 75, 75);

    assertSelectedElements([]);
  });

  it("should select a transparent rectangle when the selection box crosses its outline", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, 25, 125, 75);

    assertSelectedElements([rect1.id]);
  });

  it("should not select a rotated transparent rectangle when the selection box stays inside it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(40, 40, 60, 60);

    assertSelectedElements([]);
  });

  it("should select a rotated rounded rectangle when the selection box contains its outline but not its bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 180,
      angle: Math.PI / 6,
      backgroundColor: "transparent",
      fillStyle: "solid",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
      roughness: 0,
    });

    API.setElements([rect]);

    const sceneRect = API.getElement(rect);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [boundsX1, boundsY1, boundsX2, boundsY2] = getElementBounds(
      sceneRect,
      elementsMap,
    );
    const [outlineX1, outlineY1, outlineX2, outlineY2] = getOutlineBounds(rect);

    expect(outlineX1).toBeGreaterThan(boundsX1 - 1);
    expect(outlineY1).toBeGreaterThan(boundsY1 - 1);
    expect(outlineX2).toBeLessThan(boundsX2 + 1);
    expect(outlineY2).toBeLessThan(boundsY2 + 1);

    boxSelect(
      outlineX1 - (outlineX1 - boundsX1) / 2,
      outlineY1 - (outlineY1 - boundsY1) / 2,
      outlineX2 + (boundsX2 - outlineX2) / 2,
      outlineY2 + (boundsY2 - outlineY2) / 2,
    );

    assertSelectedElements([rect.id]);
  });

  it("should not select a filled rotated rectangle when the selection box only overlaps its axis-aligned bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect]);

    boxSelectTopLeftAabbCorner(rect);

    assertSelectedElements([]);
  });

  it("should not select a filled ellipse when the selection box only overlaps its bounds corner", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([ellipse]);

    boxSelectTopRightAabbCorner(ellipse);

    assertSelectedElements([]);
  });

  it("should not select a filled diamond when the selection box only overlaps its bounds corner", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([diamond]);

    boxSelectTopRightAabbCorner(diamond);

    assertSelectedElements([]);
  });

  it("should not select a filled rotated ellipse when the selection box only overlaps its axis-aligned bounds", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([ellipse]);

    boxSelectTopLeftRotatedLocalBoundsCorner(ellipse);

    assertSelectedElements([]);
  });

  it("should not select a filled rotated diamond when the selection box only overlaps its rotated local bounds", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([diamond]);

    boxSelectTopLeftRotatedLocalBoundsCorner(diamond);

    assertSelectedElements([]);
  });

  it("should not select rotated text when the selection box only overlaps its axis-aligned bounds", () => {
    const text = API.createElement({
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      text: "test",
    });

    API.setElements([text]);

    boxSelect(-18, -18, -8, -8);

    assertSelectedElements([]);
  });

  it("should not select rotated image when the selection box only overlaps its axis-aligned bounds", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      fileId: "file_A",
      status: "saved",
    });

    API.setElements([image]);

    boxSelect(-18, -18, -8, -8);

    assertSelectedElements([]);
  });

  it("should deselect a selected rotated rectangle when clicking in the empty corner of its axis-aligned bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect]);

    mouse.clickAt(50, 50);
    assertSelectedElements([rect.id]);

    const sceneRect = API.getElement(rect);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneRect, elementsMap);

    mouse.clickAt(x1 + 2, y1 + 2);

    assertSelectedElements([]);
  });

  it("should not select a line when the selection box only overlaps its bounds", () => {
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
    });

    API.setElements([line]);

    boxSelect(20, 50, 30, 60);

    assertSelectedElements([]);
  });

  it("should not click-select rotated freedraw in the corner of its axis-aligned bounds", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "transparent",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
    });

    API.setElements([freedraw]);

    const sceneFreedraw = API.getElement(freedraw);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneFreedraw, elementsMap);

    mouse.clickAt(x1 + 2, y1 + 2);

    assertSelectedElements([]);
  });

  it("should not select a freedraw when the selection box only overlaps its bounds", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 50),
        pointFrom<LocalPoint>(100, 100),
      ],
    });

    API.setElements([freedraw]);

    boxSelect(20, 50, 30, 60);

    assertSelectedElements([]);
  });

  it("should not select a transparent framed element when the selection box stays inside its clipped bounds", () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });
    const rect1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 10,
      width: 100,
      height: 80,
      frameId: frame.id,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([frame, rect1]);

    boxSelect(60, 20, 90, 60);

    assertSelectedElements([]);
  });

  it("should not select a framed element when selection only overlaps its clipped-out outline", () => {
    const frame = API.createElement({
      type: "frame",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const rect1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      frameId: frame.id,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([frame, rect1]);

    boxSelect(40, 170, 70, 220);

    assertSelectedElements([]);
  });
});

describe("selection element", () => {
  it("create selection element on pointer down", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });

    const selectionElement = h.state.selectionElement!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 100]);
    expect([selectionElement.width, selectionElement.height]).toEqual([0, 0]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("resize selection element on pointer move", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });

    const selectionElement = h.state.selectionElement!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 30]);
    expect([selectionElement.width, selectionElement.height]).toEqual([90, 70]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("remove selection element on pointer up", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });
    fireEvent.pointerUp(canvas);

    expect(h.state.selectionElement).toBeNull();
  });
});

describe("selectedElementIds stability", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("box-selection should be stable when not changing selection", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });

    API.setElements([rectangle]);

    const selectedElementIds_1 = h.state.selectedElementIds;

    mouse.downAt(-100, -100);
    mouse.moveTo(-50, -50);
    mouse.up();

    expect(h.state.selectedElementIds).toBe(selectedElementIds_1);

    mouse.downAt(-50, -50);
    mouse.move(-1000, -1000);
    mouse.moveTo(50, 50);

    const selectedElementIds_2 = h.state.selectedElementIds;

    expect(selectedElementIds_2).toEqual({ [rectangle.id]: true });

    mouse.moveTo(60, 60);

    // box-selecting further without changing selection should keep
    // selectedElementIds stable (the same object)
    expect(h.state.selectedElementIds).toBe(selectedElementIds_2);

    mouse.up();

    expect(h.state.selectedElementIds).toBe(selectedElementIds_2);
  });
});
