import React from "react";

import type { ExcalidrawFrameElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import {
  GlobalTestState,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const labelNode = (frame: ExcalidrawFrameElement) =>
  document.getElementById(
    `${h.app.id}-frame-name-${frame.id}`,
  ) as HTMLDivElement | null;

const renderedFrame = async (frame: ExcalidrawFrameElement) => {
  API.setElements([frame]);
  await waitFor(() => expect(labelNode(frame)).not.toBe(null));
  return frame;
};

const startEditingName = async (frame: ExcalidrawFrameElement) => {
  API.updateElement(frame, { name: "before" });
  API.setAppState({ editingFrame: frame.id });

  const input = await waitFor(() => {
    const node =
      GlobalTestState.renderResult.container.querySelector(".frame-name input");
    expect(node).not.toBe(null);
    return node as HTMLInputElement;
  });
  fireEvent.change(input, { target: { value: "  committed  " } });
};

describe("frame name rendering", () => {
  beforeEach(async () => {
    mockBoundingClientRect({ width: 1920, height: 1080 });
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(1920));
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("renders no label when frame names are turned off, committing the edit in flight", async () => {
    const frame = await renderedFrame(
      API.createElement({ type: "frame", x: 100, y: 100 }),
    );
    await startEditingName(frame);

    API.setAppState({
      frameRendering: { enabled: true, name: false, outline: true, clip: true },
    });

    await waitFor(() => {
      expect(labelNode(frame)).toBe(null);
      expect(h.state.editingFrame).toBe(null);
    });
    // upstream ends the session with `resetEditingFrame(null)` here, so the
    // typed name stands as typed — only a commit that names the frame trims it
    expect(API.getElement(frame).name).toBe("  committed  ");
  });

  it("renders no label when frame rendering is turned off", async () => {
    const frame = await renderedFrame(
      API.createElement({ type: "frame", x: 100, y: 100 }),
    );

    API.setAppState({
      frameRendering: { enabled: false, name: true, outline: true, clip: true },
    });

    await waitFor(() => expect(labelNode(frame)).toBe(null));
  });

  it("renders no label for a frame outside the viewport, committing the edit in flight", async () => {
    const frame = await renderedFrame(
      API.createElement({ type: "frame", x: 100, y: 100 }),
    );
    await startEditingName(frame);

    API.setAppState({ scrollX: -10000, scrollY: -10000 });

    await waitFor(() => {
      expect(labelNode(frame)).toBe(null);
      expect(h.state.editingFrame).toBe(null);
    });
    expect(API.getElement(frame).name).toBe("committed");
  });

  it("widens the label of the focused search match", async () => {
    const frame = await renderedFrame(
      API.createElement({ type: "frame", x: 100, y: 100, width: 200 }),
    );

    expect(labelNode(frame)!.style.maxWidth).toBe("200px");

    API.setAppState({
      searchMatches: {
        focusedId: frame.id,
        matches: [
          {
            id: frame.id,
            focus: true,
            matchedLines: [],
          },
        ],
      },
    });

    await waitFor(() => expect(labelNode(frame)!.style.maxWidth).toBe("none"));
  });

  it("keeps the label of an unfocused search match at the frame's width", async () => {
    const frame = await renderedFrame(
      API.createElement({ type: "frame", x: 100, y: 100, width: 200 }),
    );

    API.setAppState({
      searchMatches: {
        focusedId: frame.id,
        matches: [
          {
            id: frame.id,
            focus: false,
            matchedLines: [],
          },
        ],
      },
    });

    await waitFor(() => expect(labelNode(frame)!.style.maxWidth).toBe("200px"));
  });
});
