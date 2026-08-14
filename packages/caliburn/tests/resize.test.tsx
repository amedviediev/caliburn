import React from "react";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { UI, Keyboard } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 1000;
  UI.clickTool("selection");
});

describe("generic element", () => {
  // = rectangle/diamond/ellipse

  describe("resizes", () => {
    it.each`
      handle  | move          | size          | xy
      ${"n"}  | ${[10, -27]}  | ${[200, 127]} | ${[0, -27]}
      ${"e"}  | ${[67, -45]}  | ${[267, 100]} | ${[0, 0]}
      ${"s"}  | ${[-50, -39]} | ${[200, 61]}  | ${[0, 0]}
      ${"w"}  | ${[20, 90]}   | ${[180, 100]} | ${[20, 0]}
      ${"ne"} | ${[5, -33]}   | ${[205, 133]} | ${[0, -33]}
      ${"se"} | ${[-30, -81]} | ${[170, 19]}  | ${[0, 0]}
      ${"sw"} | ${[37, 25]}   | ${[163, 125]} | ${[37, 0]}
      ${"nw"} | ${[-34, 42]}  | ${[234, 58]}  | ${[-34, 42]}
    `(
      "with handle $handle",
      async ({ handle, move, size: [width, height], xy: [x, y] }) => {
        const rectangle = UI.createElement("rectangle", {
          width: 200,
          height: 100,
        });
        UI.resize(rectangle, handle, move);

        expect(rectangle.x).toBeCloseTo(x);
        expect(rectangle.y).toBeCloseTo(y);
        expect(rectangle.width).toBeCloseTo(width);
        expect(rectangle.height).toBeCloseTo(height);
        expect(rectangle.angle).toBeCloseTo(0);
      },
    );
  });

  describe("flips while resizing", () => {
    it.each`
      handle  | move           | size          | xy
      ${"n"}  | ${[15, 139]}   | ${[200, 39]}  | ${[0, 100]}
      ${"e"}  | ${[-245, 67]}  | ${[45, 100]}  | ${[-45, 0]}
      ${"s"}  | ${[-26, -210]} | ${[200, 110]} | ${[0, -110]}
      ${"w"}  | ${[241, 0]}    | ${[41, 100]}  | ${[200, 0]}
      ${"ne"} | ${[-250, 125]} | ${[50, 25]}   | ${[-50, 100]}
      ${"se"} | ${[-283, -58]} | ${[83, 42]}   | ${[-83, 0]}
      ${"sw"} | ${[40, -123]}  | ${[160, 23]}  | ${[40, -23]}
      ${"nw"} | ${[270, 133]}  | ${[70, 33]}   | ${[200, 100]}
    `(
      "with handle $handle",
      async ({ handle, move, size: [width, height], xy: [x, y] }) => {
        const rectangle = UI.createElement("rectangle", {
          width: 200,
          height: 100,
        });
        UI.resize(rectangle, handle, move);

        expect(rectangle.x).toBeCloseTo(x);
        expect(rectangle.y).toBeCloseTo(y);
        expect(rectangle.width).toBeCloseTo(width);
        expect(rectangle.height).toBeCloseTo(height);
        expect(rectangle.angle).toBeCloseTo(0);
      },
    );
  });

  it("resizes with locked aspect ratio", async () => {
    const rectangle = UI.createElement("rectangle", {
      width: 200,
      height: 100,
    });
    UI.resize(rectangle, "se", [100, 10], { shift: true });

    expect(rectangle.x).toBeCloseTo(0);
    expect(rectangle.y).toBeCloseTo(0);
    expect(rectangle.width).toBeCloseTo(300);
    expect(rectangle.height).toBeCloseTo(150);
    expect(rectangle.angle).toBeCloseTo(0);

    UI.resize(rectangle, "n", [30, 50], { shift: true });

    expect(rectangle.x).toBeCloseTo(50);
    expect(rectangle.y).toBeCloseTo(50);
    expect(rectangle.width).toBeCloseTo(200);
    expect(rectangle.height).toBeCloseTo(100);
    expect(rectangle.angle).toBeCloseTo(0);
  });

  it("resizes from center", async () => {
    const rectangle = UI.createElement("rectangle", {
      width: 200,
      height: 100,
    });
    UI.resize(rectangle, "nw", [20, 10], { alt: true });

    expect(rectangle.x).toBeCloseTo(20);
    expect(rectangle.y).toBeCloseTo(10);
    expect(rectangle.width).toBeCloseTo(160);
    expect(rectangle.height).toBeCloseTo(80);
    expect(rectangle.angle).toBeCloseTo(0);

    UI.resize(rectangle, "e", [15, 43], { alt: true });

    expect(rectangle.x).toBeCloseTo(5);
    expect(rectangle.y).toBeCloseTo(10);
    expect(rectangle.width).toBeCloseTo(190);
    expect(rectangle.height).toBeCloseTo(80);
    expect(rectangle.angle).toBeCloseTo(0);
  });

  // it("resizes with bound arrow", async () => {
  //   const rectangle = UI.createElement("rectangle", {
  //     width: 200,
  //     height: 100,
  //   });
  //   const arrow = UI.createElement("arrow", {
  //     x: -30,
  //     y: 50,
  //     width: 28,
  //     height: 5,
  //   });

  //   expect(arrow.endBinding?.elementId).toEqual(rectangle.id);

  //   UI.resize(rectangle, "e", [40, 0]);

  //   expect(arrow.width + arrow.endBinding!.gap).toBeCloseTo(30, 0);

  //   UI.resize(rectangle, "w", [50, 0]);

  //   expect(arrow.endBinding?.elementId).toEqual(rectangle.id);
  //   expect(arrow.width + arrow.endBinding!.gap).toBeCloseTo(80, 0);
  // });
});

describe("rotation handle", () => {
  it("rotates a rectangle", async () => {
    const rectangle = UI.createElement("rectangle", {
      width: 200,
      height: 100,
    });
    expect(rectangle.angle).toBeCloseTo(0);

    UI.rotate(rectangle, [60, 36]);

    expect(rectangle.get().angle).not.toBeCloseTo(0);

    Keyboard.undo();
  });
});
