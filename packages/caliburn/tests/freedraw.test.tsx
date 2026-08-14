import React from "react";

import { reseed } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { UI } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

describe("freedraw", () => {
  it("applies currentItemStrokeVariability to newly drawn freedraw elements", () => {
    // default app state draws constant-width strokes
    expect(h.state.currentItemStrokeVariability).toBe("constant");

    UI.createElement("freedraw", { x: 0, y: 0 });

    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("constant");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
  });

  it("draws a multi-point stroke and finalizes on pointer up", () => {
    const element = UI.createElement("freedraw", {
      x: 10,
      y: 10,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(15, 5),
        pointFrom<LocalPoint>(30, 20),
        pointFrom<LocalPoint>(45, 10),
      ],
    });

    const drawn = element.get();
    expect(drawn.type).toBe("freedraw");
    expect(drawn.points.length).toBeGreaterThanOrEqual(4);
    expect(h.state.newElement).toBeNull();
    // the freedraw tool stays active for back-to-back strokes
    expect(h.state.activeTool.type).toBe("freedraw");
    expect(h.state.selectedElementIds[drawn.id]).toBeFalsy();
  });
});
