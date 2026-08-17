import React from "react";

import "@excalidraw/utils/test-utils";

import type { ExcalidrawElbowArrowElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { Pointer, UI } from "./helpers/ui";
import { render } from "./test-utils";

const mouse = new Pointer("mouse");

/**
 * Double-clicking an elbow arrow's fixed-segment midpoint deletes the segment
 * (upstream `App.handleCanvasDoubleClick`, App.tsx:7017-7078).
 *
 * `elbowArrow.test.tsx` has the upstream case for this, but its
 * `toCloselyEqualPoints` runs at the default precision — a ±100 tolerance,
 * which every route this arrow can take passes. These assert the route
 * exactly, and that the double-click did not fall through to the branch that
 * starts a label on the arrow instead.
 */
describe("elbow arrow fixed-segment delete", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    mouse.reset();
  });

  const elbowArrowWithFixedSegment = () => {
    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");

    mouse.reset();
    mouse.moveTo(0, 0);
    mouse.click();
    mouse.moveTo(250, 200);
    mouse.click();

    // drag the middle segment sideways, which pins it as a fixed segment
    mouse.reset();
    mouse.moveTo(125, 100);
    mouse.down();
    mouse.moveTo(130, 100);
    mouse.up();

    const arrow = h.scene.getSelectedElements(
      h.state,
    )[0] as ExcalidrawElbowArrowElement;
    expect(arrow.fixedSegments?.length).toBe(1);
    expect(arrow.points).toCloselyEqualPoints(
      [
        [0, 0],
        [130, 0],
        [130, 200],
        [250, 200],
      ],
      1,
    );
    return arrow;
  };

  it("double-clicking the midpoint deletes the fixed segment", () => {
    const arrow = elbowArrowWithFixedSegment();

    mouse.reset();
    mouse.moveTo(130, 100);
    mouse.doubleClick();

    expect(arrow.fixedSegments ?? []).toEqual([]);
    // back to the unpinned route, whose corner is the midpoint of the span
    expect(arrow.points).toCloselyEqualPoints(
      [
        [0, 0],
        [125, 0],
        [125, 200],
        [250, 200],
      ],
      1,
    );
  });

  it("double-clicking the midpoint starts no label on the arrow", () => {
    elbowArrowWithFixedSegment();

    mouse.reset();
    mouse.moveTo(130, 100);
    mouse.doubleClick();

    expect(h.elements.filter((element) => element.type === "text")).toEqual([]);
    expect(h.state.editingTextElement).toBe(null);
  });
});
