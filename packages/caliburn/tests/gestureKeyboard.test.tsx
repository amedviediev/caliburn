import React from "react";

import { arrayToMap, reseed } from "@excalidraw/common";
import { getTransformHandles } from "@excalidraw/element";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { fireEvent, render, unmountComponent } from "./test-utils";

unmountComponent();

const mouse = new Pointer("mouse");

/**
 * The gesture installs its keyboard listeners on WINDOW, beside the pointer
 * move & up ones — a modifier pressed anywhere reaches them, and nothing else
 * in the editor listens there.
 */
const pressShift = () =>
  fireEvent.keyDown(window, { key: "Shift", shiftKey: true });
const releaseShift = () =>
  fireEvent.keyUp(window, { key: "Shift", shiftKey: false });

/** the client coords of the centre of a transform handle */
const handleCenter = (
  element: { id: string },
  handle: "se",
): [number, number] => {
  const coords = getTransformHandles(
    h.elements.find((el) => el.id === element.id)!,
    h.state.zoom,
    arrayToMap(h.elements),
    "mouse",
    {},
  )[handle]!;
  return [coords[0] + coords[2] / 2, coords[1] + coords[3] / 2];
};

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
  await render(<Excalidraw />);
  h.state.width = 1000;
  h.state.height = 1000;
});

describe("keyboard during a pointer gesture", () => {
  it("locks the aspect ratio mid-resize with no pointer move", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    mouse.downAt(...handleCenter(rectangle, "se"));
    mouse.moveTo(400, 300);

    const resized = () => h.elements[0];
    const freeWidth = resized().width;
    const freeHeight = resized().height;
    // dragged out of the element's own 2:1 aspect ratio
    expect(freeWidth / freeHeight).not.toBeCloseTo(2);

    // the modifier alone, with the pointer where it already was
    pressShift();
    expect(resized().width / resized().height).toBeCloseTo(2);

    releaseShift();
    expect(resized().width).toBeCloseTo(freeWidth);
    expect(resized().height).toBeCloseTo(freeHeight);

    mouse.upAt(400, 300);
  });

  it("locks the aspect ratio of the element being drawn with no pointer move", () => {
    UI.clickTool("rectangle");
    mouse.downAt(100, 100);
    mouse.moveTo(300, 200);

    const drawn = () => h.state.newElement!;
    expect(drawn().width).toBeCloseTo(200);
    expect(drawn().height).toBeCloseTo(100);

    pressShift();
    expect(drawn().width).toBeCloseTo(200);
    expect(drawn().height).toBeCloseTo(200);

    releaseShift();
    expect(drawn().width).toBeCloseTo(200);
    expect(drawn().height).toBeCloseTo(100);

    mouse.upAt(300, 200);
  });

  it("stops listening once the gesture ends", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    mouse.downAt(...handleCenter(rectangle, "se"));
    mouse.moveTo(400, 300);
    mouse.upAt(400, 300);

    const { width, height } = h.elements[0];
    pressShift();
    expect(h.elements[0].width).toBeCloseTo(width);
    expect(h.elements[0].height).toBeCloseTo(height);
  });
});
