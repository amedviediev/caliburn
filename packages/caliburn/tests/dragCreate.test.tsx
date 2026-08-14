import React from "react";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

unmountComponent();

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

describe("Test dragCreate", () => {
  describe("add element to the scene when pointer dragging long enough", () => {
    it("rectangle", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // move to (60,70)
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(h.state.selectionElement).toBeNull();

      expect(h.elements.length).toEqual(1);
      expect(h.elements[0].type).toEqual("rectangle");
      expect(h.elements[0].x).toEqual(30);
      expect(h.elements[0].y).toEqual(20);
      expect(h.elements[0].width).toEqual(30); // 60 - 30
      expect(h.elements[0].height).toEqual(50); // 70 - 20

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) => expect(element).toMatchSnapshot());
    });

    it("ellipse", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("ellipse");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // move to (60,70)
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(h.state.selectionElement).toBeNull();

      expect(h.elements.length).toEqual(1);
      expect(h.elements[0].type).toEqual("ellipse");
      expect(h.elements[0].x).toEqual(30);
      expect(h.elements[0].y).toEqual(20);
      expect(h.elements[0].width).toEqual(30); // 60 - 30
      expect(h.elements[0].height).toEqual(50); // 70 - 20

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) => expect(element).toMatchSnapshot());
    });

    it("diamond", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("diamond");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // move to (60,70)
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(h.state.selectionElement).toBeNull();

      expect(h.elements.length).toEqual(1);
      expect(h.elements[0].type).toEqual("diamond");
      expect(h.elements[0].x).toEqual(30);
      expect(h.elements[0].y).toEqual(20);
      expect(h.elements[0].width).toEqual(30); // 60 - 30
      expect(h.elements[0].height).toEqual(50); // 70 - 20

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) => expect(element).toMatchSnapshot());
    });
  });

  describe("do not add element to the scene if size is too small", () => {
    beforeAll(() => {
      mockBoundingClientRect();
    });
    afterAll(() => {
      restoreOriginalGetBoundingClientRect();
    });

    it("rectangle", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(0);
    });

    it("ellipse", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("ellipse");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(0);
    });

    it("diamond", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("diamond");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(0);
    });
  });
});
