import React from "react";

import { KEYS, THEME } from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { eyeDropperCursor } from "../src/components/eye-dropper";

import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

const { h } = window;

describe("eye dropper", () => {
  it("owns the cursor SVG paths without the React icon module", () => {
    expect(eyeDropperCursor).toContain(
      encodeURIComponent(
        "M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z",
      ),
    );
    expect(eyeDropperCursor).toContain(encodeURIComponent("M11 7l6 6"));
  });

  it("keeps the color preview within the editor container", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    Keyboard.keyPress("i");

    const preview = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    const eyeDropperContainer =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-backdrop",
      )!;
    expect(eyeDropperContainer.style.cursor).toMatch(
      /^url\(data:image\/svg\+xml/,
    );
    expect(eyeDropperContainer.style.cursor).toMatch(/\) 2 21, auto$/);

    eyeDropperContainer.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 500,
      bottom: 350,
      width: 400,
      height: 300,
      x: 100,
      y: 50,
      toJSON: () => {},
    });
    Object.defineProperties(preview, {
      offsetWidth: { configurable: true, value: 48 },
      offsetHeight: { configurable: true, value: 48 },
    });

    // This position fits within the viewport, but not within the editor.
    fireEvent.pointerMove(window, { clientX: 480, clientY: 330 });

    expect(preview.style.left).toBe("325px");
    expect(preview.style.top).toBe("225px");
  });

  it("applies the unfiltered color in dark mode", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
      />,
    );

    const ctx = h.app.canvas.getContext("2d")!;
    vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([18, 18, 18, 255]),
    } as ImageData);

    Keyboard.keyPress(KEYS.I);

    const eyeDropperContainer = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.pointerUp(eyeDropperContainer, {
      clientX: 50,
      clientY: 50,
    });

    expect(h.state.currentItemBackgroundColor).toBe("#ffffff");
  });

  it("contrasts the preview border with the sampled color", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    const ctx = h.app.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([18, 18, 18, 255]),
    } as ImageData);

    Keyboard.keyPress(KEYS.I);

    const preview = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    expect(
      preview.style.getPropertyValue("--eye-dropper-preview-border-color"),
    ).toBe("#fff");

    getImageDataSpy.mockReturnValue({
      data: new Uint8ClampedArray([237, 237, 237, 255]),
    } as ImageData);
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });

    expect(
      preview.style.getPropertyValue("--eye-dropper-preview-border-color"),
    ).toBe("#222");
  });
});
