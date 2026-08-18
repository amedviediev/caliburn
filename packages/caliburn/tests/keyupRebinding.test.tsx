import { KEYS } from "@excalidraw/common";

import {
  bindBindingElement,
  calculateFixedPointForNonElbowArrowBinding,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  FixedPointBinding,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, render } from "./test-utils";

/**
 * A rectangle with an arrow whose end is bound to it, the arrow approaching
 * from the right.
 */
const boundArrow = (opts: { elbowed?: boolean } = {}) => {
  const rect = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  }) as NonDeleted<ExcalidrawBindableElement>;
  const arrow = API.createElement({
    type: "arrow",
    elbowed: opts.elbowed ?? false,
    x: 200,
    y: 50,
    width: -90,
    height: 0,
    points: [pointFrom(0, 0), pointFrom(-90, 0)],
  }) as NonDeleted<ExcalidrawArrowElement>;
  API.setElements([rect, arrow]);

  act(() => {
    bindBindingElement(arrow, rect, "orbit", "end", h.scene);
  });

  return { rect, arrow };
};

const endFixedPoint = (arrow: NonDeleted<ExcalidrawArrowElement>) =>
  (arrow.endBinding as FixedPointBinding).fixedPoint;

describe("rebinding on arrow-key release", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("recomputes the fixed point of a selected simple arrow", () => {
    const { rect, arrow } = boundArrow();
    const before = [...endFixedPoint(arrow)];

    // move the bind target out from under the binding without letting the
    // arrow follow, so the stored ratio no longer matches the geometry
    API.updateElement(rect, { y: rect.y + 40 });
    // the arrow alone: the keydown nudge drops arrows whose bind target is
    // unselected, so nothing moves and only the release is under test
    API.setSelectedElements([arrow]);

    Keyboard.keyPress(KEYS.ARROW_RIGHT);

    expect(endFixedPoint(arrow)).toEqual(
      calculateFixedPointForNonElbowArrowBinding(
        arrow,
        rect,
        "end",
        h.scene.getNonDeletedElementsMap(),
      ).fixedPoint,
    );
    expect(endFixedPoint(arrow)).not.toEqual(before);
  });

  it("leaves an elbow arrow's fixed point alone", () => {
    const { rect, arrow } = boundArrow({ elbowed: true });
    const before = [...endFixedPoint(arrow)];

    API.updateElement(rect, { y: rect.y + 40 });
    API.setSelectedElements([arrow]);

    Keyboard.keyPress(KEYS.ARROW_RIGHT);

    expect(endFixedPoint(arrow)).toEqual(before);
  });

  it("leaves an unselected arrow alone", () => {
    const { rect, arrow } = boundArrow();
    const before = [...endFixedPoint(arrow)];
    // something else to nudge, clear of the arrow and its bind target
    const other = API.createElement({
      type: "rectangle",
      x: 500,
      y: 500,
      width: 100,
      height: 100,
    });
    API.setElements([...h.elements, other]);

    API.updateElement(rect, { y: rect.y + 40 });
    API.setSelectedElements([other]);

    Keyboard.keyPress(KEYS.ARROW_RIGHT);

    expect(endFixedPoint(arrow)).toEqual(before);
  });

  it("drops the suggested binding", () => {
    const { rect } = boundArrow();
    act(() =>
      h.app.setState({
        suggestedBinding: { element: rect },
      }),
    );
    expect(h.state.suggestedBinding).not.toBe(null);

    Keyboard.keyUp(KEYS.ARROW_RIGHT);

    expect(h.state.suggestedBinding).toBe(null);
  });

  it("keeps it on the release of any other key", () => {
    const { rect } = boundArrow();
    act(() =>
      h.app.setState({
        suggestedBinding: { element: rect },
      }),
    );

    Keyboard.keyUp(KEYS.A);

    expect(h.state.suggestedBinding).not.toBe(null);
  });
});
