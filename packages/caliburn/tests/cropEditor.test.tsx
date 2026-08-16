import React from "react";

import { IMAGE_MIME_TYPES, KEYS, arrayToMap } from "@excalidraw/common";

import {
  getCommonBounds,
  getTransformHandles,
  getTransformHandlesFromCoords,
} from "@excalidraw/element";

import type { Radians } from "@excalidraw/math";

import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  GlobalTestState,
  act,
  fireEvent,
  render,
  unmountComponent,
} from "./test-utils";

const mouse = new Pointer("mouse");

unmountComponent();

const openContextMenuOn = (x: number, y: number) => {
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: x,
    clientY: y,
  });
  return UI.queryContextMenu()!;
};

const seedImage = () => {
  const image = API.createElement({
    type: "image",
    x: 20,
    y: 20,
    width: 100,
    height: 100,
    fileId: "fileId" as any,
  });
  act(() => {
    API.setElements([image]);
    API.setSelectedElements([image]);
  });
  return image as ExcalidrawImageElement;
};

/**
 * `maybeHandleCrop` (App.tsx's `maybeHandleCrop`) reads the crop's natural
 * size off `imageCache`, not off the element — real image loads populate it
 * asynchronously, so tests populate it directly with a resolved size.
 */
const seedImageCache = (image: ExcalidrawImageElement) => {
  h.app.imageCache.set(image.fileId!, {
    image: { naturalWidth: 400, naturalHeight: 400 } as HTMLImageElement,
    mimeType: IMAGE_MIME_TYPES.png,
  });
};

// Upstream drives the crop editor from `App.tsx`'s own suites, none of which
// caliburn carries; the context-menu entry, the exit paths and the
// handle-drag are covered directly below instead.
describe("crop editor context menu entry", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("enters crop mode for a single selected image", () => {
    const image = seedImage();

    const contextMenu = openContextMenuOn(60, 60);
    const cropItem = contextMenu.querySelector(`li[data-testid="cropEditor"]`);
    expect(cropItem).not.toBe(null);

    fireEvent.click(cropItem!);

    expect(h.state.croppingElementId).toBe(image.id);
    expect(h.state.isCropping).toBe(false);
  });

  it("is absent for a non-image element and while already cropping", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 100,
      height: 100,
    });
    act(() => {
      API.setElements([rect]);
      API.setSelectedElements([rect]);
    });

    expect(
      openContextMenuOn(60, 60).querySelector(`li[data-testid="cropEditor"]`),
    ).toBe(null);

    const image = seedImage();
    act(() => {
      h.app.setState({ croppingElementId: image.id });
    });

    expect(
      openContextMenuOn(60, 60).querySelector(`li[data-testid="cropEditor"]`),
    ).toBe(null);
  });
});

// Caliburn-authored: covers the interaction half of the crop editor ported
// from `App.tsx`'s inline keyboard handling, `handleSelectionOnPointerDown`'s
// crop-exit branch, and the pointer-up "click outside" check — none of which
// upstream's own crop suite (`packages/element/tests/cropElement.test.tsx`)
// exercises portably, since it drives the vendored React `App` directly.
describe("crop editor keyboard shortcuts", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("Enter starts crop mode for a single selected image", () => {
    const image = seedImage();
    expect(h.state.croppingElementId).toBe(null);

    Keyboard.keyDown(KEYS.ENTER);

    expect(h.state.croppingElementId).toBe(image.id);
  });

  it("Escape exits crop mode", () => {
    const image = seedImage();
    act(() => {
      h.app.setState({ croppingElementId: image.id });
    });

    Keyboard.keyDown(KEYS.ESCAPE);

    expect(h.state.croppingElementId).toBe(null);
  });

  it("Enter exits crop mode while already cropping", () => {
    const image = seedImage();
    act(() => {
      h.app.setState({ croppingElementId: image.id });
    });

    Keyboard.keyDown(KEYS.ENTER);

    expect(h.state.croppingElementId).toBe(null);
  });
});

describe("crop editor pointer exit paths", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("clicking a different element exits crop mode", () => {
    const image = seedImage();
    const rect = API.createElement({
      type: "rectangle",
      x: 300,
      y: 300,
      width: 50,
      height: 50,
    });
    act(() => {
      API.setElements([image, rect]);
      h.app.setState({ croppingElementId: image.id });
    });

    mouse.clickOn(rect);

    expect(h.state.croppingElementId).toBe(null);
  });

  it("clicking empty canvas exits crop mode", () => {
    const image = seedImage();
    act(() => {
      h.app.setState({ croppingElementId: image.id });
    });

    mouse.reset();
    mouse.click(500, 500);

    expect(h.state.croppingElementId).toBe(null);
  });

  /**
   * Pointer-up runs the crop exit ahead of the deselect, which is where
   * upstream returns from the handler (App.tsx 12051 then 12263) — so a
   * pointer-up that does both must still exit crop.
   *
   * Reaching that seam takes a seeded state: `handleSelectionPointerDown`'s
   * own crop exit pre-empts every click that would otherwise arrive at
   * pointer-up with crop still live, and the deselect needs a multi-element
   * selection (its single-element half cannot fire for an image, whose
   * bounding box is its shape). A pointer-down on a transform handle is the
   * one path that returns before that pointer-down crop exit.
   */
  it("a pointer-up that deselects still exits crop mode", () => {
    const image = seedImage();
    const rect = API.createElement({
      type: "rectangle",
      x: 200,
      y: 20,
      width: 100,
      height: 100,
    });
    act(() => {
      API.setElements([image, rect]);
      h.app.setState({
        selectedElementIds: { [image.id]: true, [rect.id]: true },
        croppingElementId: image.id,
      });
    });

    const [x1, y1, x2, y2] = getCommonBounds([image, rect]);
    const handle = getTransformHandlesFromCoords(
      [x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2],
      0 as Radians,
      h.state.zoom,
      "mouse",
    ).nw!;

    mouse.reset();
    mouse.downAt(handle[0] + handle[2] / 2, handle[1] + handle[3] / 2);
    // the armed handle returns before the pointer-down's own crop exit, so
    // crop is still live when pointer-up runs both branches
    expect(h.state.croppingElementId).toBe(image.id);

    mouse.upAt();

    expect(h.state.croppingElementId).toBe(null);
    expect(API.getSelectedElements()).toEqual([]);
  });
});

describe("crop editor handle drag", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("dragging a crop handle crops the image via cropElement, and pointer-up keeps crop mode active", () => {
    const image = seedImage();
    seedImageCache(image);
    act(() => {
      h.app.setState({ croppingElementId: image.id });
    });

    const initialWidth = image.width;
    const handle = getTransformHandles(
      image,
      h.state.zoom,
      arrayToMap(h.elements),
      "mouse",
      {},
    ).w!;
    const clientX = handle[0] + handle[2] / 2;
    const clientY = handle[1] + handle[3] / 2;

    mouse.reset();
    mouse.down(clientX, clientY);
    mouse.move(30, 0);

    // still mid-drag: `maybeHandleCrop` toggles `isCropping` on, matching
    // upstream's own transform-handle-active signal
    expect(h.state.isCropping).toBe(true);
    expect(h.state.croppingElementId).toBe(image.id);

    mouse.up();

    const croppedImage = h.elements.find(
      (el) => el.id === image.id,
    ) as ExcalidrawImageElement;
    expect(croppedImage.width).toBeLessThan(initialWidth);
    expect(croppedImage.crop).not.toBe(null);
    // the drag hit no element under the pointer (handles sit outside the
    // shape), so the pointer-up "click outside" check must not treat this
    // as an exit — crop mode stays active, only `isCropping` resets
    expect(h.state.isCropping).toBe(false);
    expect(h.state.croppingElementId).toBe(image.id);
  });
});
