import React from "react";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import {
  GlobalTestState,
  act,
  fireEvent,
  render,
  unmountComponent,
} from "./test-utils";

const { h } = window;

unmountComponent();

const openContextMenuOn = (x: number, y: number) => {
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: x,
    clientY: y,
  });
  return UI.queryContextMenu()!;
};

// Upstream drives the crop editor from `App.tsx`'s own suites, none of which
// caliburn carries; the context-menu entry ported here is covered directly.
describe("crop editor context menu entry", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

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
    return image;
  };

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
