import React from "react";

import type { ExcalidrawFrameElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { render, waitFor } from "./test-utils";

const mouse = new Pointer("mouse");

const FRAME = { x: 100, y: 100, width: 200, height: 100 };

/**
 * The frame's name label as it sits on screen: `FRAME_STYLE.nameOffsetY`
 * above the frame, one `nameFontSize` line tall. jsdom lays nothing out, so
 * the box is stubbed on the rendered node — with the default appState (zoom
 * 1, no scroll, no offset) the viewport box doubles as the scene box.
 */
const LABEL = {
  x: FRAME.x,
  y: FRAME.y - 3 - 14,
  width: 60,
  height: 14,
};

const rect = (box: { x: number; y: number; width: number; height: number }) =>
  ({
    x: box.x,
    y: box.y,
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height,
    toJSON: () => {},
  } as DOMRect);

const labelNode = (frame: ExcalidrawFrameElement) =>
  document.getElementById(
    `${h.app.id}-frame-name-${frame.id}`,
  ) as HTMLDivElement | null;

const frameWithStubbedNameBox = async (box = LABEL) => {
  const frame = API.createElement({ type: "frame", ...FRAME });
  API.setElements([frame]);

  const label = await waitFor(() => {
    const node = labelNode(frame);
    expect(node).not.toBe(null);
    return node!;
  });
  label.getBoundingClientRect = () => rect(box);

  return frame;
};

describe("frame name hit testing", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw />);
  });

  it("selects the frame when its name label is clicked", async () => {
    const frame = await frameWithStubbedNameBox();

    // clear of the frame's own (threshold-padded) bounding box, inside the
    // label's
    mouse.clickAt(LABEL.x + 10, LABEL.y + 2);

    expect(h.state.selectedElementIds[frame.id]).toBe(true);
  });

  it("prefers the frame's name label over the element the label covers", async () => {
    const covered = API.createElement({
      type: "rectangle",
      x: FRAME.x,
      y: FRAME.y - 40,
      width: FRAME.width,
      height: 40,
      // opaque, so its interior is hit as well
      backgroundColor: "#ffec99",
    });
    const frame = API.createElement({ type: "frame", ...FRAME });
    API.setElements([covered, frame]);

    const label = await waitFor(() => {
      const node = labelNode(frame);
      expect(node).not.toBe(null);
      return node!;
    });
    label.getBoundingClientRect = () => rect(LABEL);

    // both are hit, the frame (on top) only through its name label
    mouse.clickAt(LABEL.x + 10, LABEL.y + 2);

    expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
  });

  it("does not select the frame when the click misses the name label", async () => {
    const frame = await frameWithStubbedNameBox();

    mouse.clickAt(LABEL.x + LABEL.width + 40, LABEL.y + 2);

    expect(h.state.selectedElementIds[frame.id]).toBeFalsy();
  });

  it("does not deselect the frame when the pointer goes up on its name label", async () => {
    // a pointer-up that only hit the bounding box of the element hit on
    // pointer-down deselects. The label sits above the frame on screen, where
    // the frame's own outline threshold already answers the hit test, so the
    // deselect path is isolated by stubbing the label's box over the frame's
    // interior — which jsdom, laying nothing out, is free to report.
    const frame = await frameWithStubbedNameBox({
      x: FRAME.x + 50,
      y: FRAME.y + 30,
      width: 60,
      height: 14,
    });
    API.setSelectedElements([frame]);

    mouse.clickAt(FRAME.x + 80, FRAME.y + 37);

    expect(h.state.selectedElementIds[frame.id]).toBe(true);
  });

  it("recomputes the cached bounds when the zoom changes", async () => {
    const frame = await frameWithStubbedNameBox();

    expect(h.app.frameNameBoundsCache.get(frame)).toMatchObject({
      x: LABEL.x,
      y: LABEL.y,
      width: LABEL.width,
      height: LABEL.height,
    });

    API.setAppState({ zoom: { value: 2 as typeof h.state.zoom.value } });

    expect(h.app.frameNameBoundsCache.get(frame)).toMatchObject({
      x: LABEL.x / 2,
      y: LABEL.y / 2,
      width: LABEL.width / 2,
      height: LABEL.height / 2,
    });
  });

  it("recomputes the cached bounds when the frame's versionNonce changes", async () => {
    const frame = await frameWithStubbedNameBox();

    const bounds = h.app.frameNameBoundsCache.get(frame);
    expect(bounds).toMatchObject({ width: LABEL.width });
    // unchanged frame, unchanged zoom -> the cached entry is handed back
    expect(h.app.frameNameBoundsCache.get(frame)).toBe(bounds);

    labelNode(frame)!.getBoundingClientRect = () =>
      rect({ ...LABEL, width: LABEL.width * 2 });
    // the cache is keyed on the frame id, so only the version bump can
    // invalidate the entry
    expect(h.app.frameNameBoundsCache.get(frame)).toBe(bounds);

    API.updateElement(frame, { name: "renamed" });

    expect(h.app.frameNameBoundsCache.get(frame)).toMatchObject({
      width: LABEL.width * 2,
    });
  });

  it("returns null when the frame's name node is not in the DOM", async () => {
    await frameWithStubbedNameBox();
    const unrendered = API.createElement({ type: "frame", ...FRAME });

    expect(labelNode(unrendered)).toBe(null);
    expect(h.app.frameNameBoundsCache.get(unrendered)).toBe(null);
  });
});
