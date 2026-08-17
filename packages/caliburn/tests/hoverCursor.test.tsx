import React from "react";

import { Excalidraw } from "../src/index";
import { getElementAtPosition } from "../src/selection-interaction";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { GlobalTestState, act, render } from "./test-utils";

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
});
