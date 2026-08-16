import React from "react";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { GlobalTestState, act, render } from "./test-utils";

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
});
