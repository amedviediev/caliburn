import React from "react";

import { CURSOR_TYPE } from "@excalidraw/common";

import { bindBindingElement } from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { getElementAtPosition } from "../src/selection-interaction";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { GlobalTestState, act, render } from "./test-utils";

const cursor = () => GlobalTestState.interactiveCanvas.style.cursor;

// the hover path derives every branch from a single hit test — spied on here
// so the count is proven rather than assumed
vi.mock("../src/selection-interaction", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/selection-interaction")
  >();
  return {
    ...actual,
    getElementAtPosition: vi.fn(actual.getElementAtPosition),
  };
});

const mouse = new Pointer("mouse");

const linkedRectangle = () => ({
  // `API.createElement` drops `link`, so it is set on the plain element
  ...API.createElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  }),
  link: "https://example.com",
});

describe("hover cursor", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw />);
  });

  it("prefers the selected element over the one on top of it", () => {
    const linked = linkedRectangle();
    const cover = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      // opaque, so its interior is hit as well
      backgroundColor: "#ffec99",
    });
    API.setElements([linked, cover]);
    API.setSelectedElements([linked]);

    mouse.moveTo(150, 150);

    expect(h.state.showHyperlinkPopup).toBe("info");
  });

  it("keeps the laser cursor in view mode", () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      }),
    ]);
    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
    API.setAppState({ viewModeEnabled: true });

    mouse.moveTo(150, 150);

    expect(GlobalTestState.interactiveCanvas.style.cursor).toContain("url(");
  });

  it("does not open the link popup for the laser tool", () => {
    const linked = linkedRectangle();
    API.setElements([linked]);
    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
    // the tool switch resets the selection, so it is made after it
    API.setSelectedElements([linked]);

    mouse.moveTo(150, 150);

    expect(h.state.showHyperlinkPopup).toBe(false);
  });

  it("ignores what a locked element on top covers", () => {
    const linked = linkedRectangle();
    const lockedCover = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      backgroundColor: "#ffec99",
      locked: true,
    });
    API.setElements([linked, lockedCover]);
    // both selected, so the preferred hit is the locked one on top
    API.setSelectedElements([linked, lockedCover]);

    mouse.moveTo(150, 150);

    // upstream nulls the hit when it is locked, and every branch reads that
    // one hit — the element underneath must not stand in for it
    expect(h.state.showHyperlinkPopup).toBe(false);
  });

  it("shows no move cursor over a locked element on top", () => {
    const covered = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      backgroundColor: "#ffec99",
    });
    const lockedCover = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      backgroundColor: "#ffec99",
      locked: true,
    });
    API.setElements([covered, lockedCover]);
    API.setSelectedElements([lockedCover]);

    mouse.moveTo(150, 150);

    expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe("move");
  });

  it("does not hit-test while a multi-point element is being laid down", () => {
    API.setElements([linkedRectangle()]);
    UI.clickTool("line");
    mouse.reset();
    mouse.clickAt(400, 400);
    expect(h.state.multiElement).not.toBe(null);

    vi.mocked(getElementAtPosition).mockClear();

    // over the linked rectangle, which the hover pass would otherwise probe
    mouse.moveTo(150, 150);

    expect(vi.mocked(getElementAtPosition)).not.toHaveBeenCalled();
    expect(h.state.showHyperlinkPopup).toBe(false);
  });

  it("hit-tests once per pointer move", () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        backgroundColor: "#ffec99",
      }),
    ]);
    vi.mocked(getElementAtPosition).mockClear();

    mouse.moveTo(150, 150);

    expect(vi.mocked(getElementAtPosition)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getElementAtPosition).mock.calls[0][3]).toEqual({
      preferSelected: true,
      includeLockedElements: true,
    });
  });

  describe("the text tool", () => {
    const arrow = () =>
      API.createElement({
        type: "arrow",
        x: 100,
        y: 300,
        width: 0,
        height: -200,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, -200)],
      });

    it("shows the text cursor over a text element", () => {
      API.setElements([
        API.createElement({ type: "text", x: 100, y: 100, text: "hello" }),
      ]);
      UI.clickTool("text");

      mouse.moveTo(110, 110);

      expect(cursor()).toBe(CURSOR_TYPE.TEXT);
    });

    it("shows the crosshair over anything else", () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          backgroundColor: "#ffec99",
        }),
      ]);
      UI.clickTool("text");

      mouse.moveTo(150, 150);
      expect(cursor()).toBe(CURSOR_TYPE.CROSSHAIR);

      // empty canvas
      mouse.moveTo(500, 500);
      expect(cursor()).toBe(CURSOR_TYPE.CROSSHAIR);
    });

    it("shows the pointer over an arrow's text anchor", () => {
      API.setElements([arrow()]);
      UI.clickTool("text");

      // the free end of the arrow
      mouse.moveTo(100, 100);

      expect(h.state.hoveredArrowTextAnchor).not.toBe(null);
      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });
  });

  it("shows the default cursor while picking an element to link to", () => {
    const source = API.createElement({ type: "rectangle", x: 0, y: 0 });
    const target = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      backgroundColor: "#ffec99",
    });
    API.setElements([source, target]);
    API.setAppState({
      openDialog: { name: "elementLinkSelector", sourceElementId: source.id },
    });

    mouse.moveTo(150, 150);

    expect(cursor()).toBe(CURSOR_TYPE.AUTO);
  });

  it("shows no move cursor over a bound elbow arrow", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    }) as NonDeleted<ExcalidrawBindableElement>;
    const elbow = API.createElement({
      type: "arrow",
      elbowed: true,
      x: 0,
      y: 50,
      width: 190,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(190, 0)],
    }) as NonDeleted<ExcalidrawArrowElement>;
    API.setElements([rect, elbow]);
    act(() => {
      bindBindingElement(elbow, rect, "orbit", "end", h.app.scene);
    });

    mouse.moveTo(100, 50);

    expect(cursor()).not.toBe(CURSOR_TYPE.MOVE);
  });

  it("shows no move cursor for the lasso tool with nothing selected", () => {
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        backgroundColor: "#ffec99",
      }),
    ]);
    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });
    API.clearSelection();

    mouse.moveTo(150, 150);

    expect(cursor()).not.toBe(CURSOR_TYPE.MOVE);
  });
});
