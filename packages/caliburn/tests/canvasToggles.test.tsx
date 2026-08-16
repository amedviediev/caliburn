import React from "react";

import { CODES, STATS_PANELS } from "@excalidraw/common";

import { isGridModeEnabled } from "@excalidraw/excalidraw/snapping";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  GlobalTestState,
  fireEvent,
  render,
  unmountComponent,
} from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

unmountComponent();

const openCanvasContextMenu = () => {
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: 400,
    clientY: 400,
  });
  return UI.queryContextMenu()!;
};

const clickContextMenuItem = (testId: string) => {
  fireEvent.click(
    openCanvasContextMenu().querySelector(`li[data-testid="${testId}"]`)!,
  );
};

describe("canvas toggles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  it("grid mode toggles from the context menu and drives the renderer", () => {
    expect(h.state.gridModeEnabled).toBe(false);
    expect(isGridModeEnabled(h.app as any)).toBe(false);

    clickContextMenuItem("gridMode");

    expect(h.state.gridModeEnabled).toBe(true);
    expect(isGridModeEnabled(h.app as any)).toBe(true);
    expect(h.app.getEffectiveGridSize()).toBe(h.state.gridSize);
  });

  it("grid mode and objects-snap mode are mutually exclusive", () => {
    clickContextMenuItem("objectsSnapMode");
    expect(h.state.objectsSnapModeEnabled).toBe(true);
    expect(h.state.gridModeEnabled).toBe(false);

    clickContextMenuItem("gridMode");
    expect(h.state.gridModeEnabled).toBe(true);
    expect(h.state.objectsSnapModeEnabled).toBe(false);
  });

  it("objects-snap mode snaps a dragged element to a neighbour's edge", () => {
    const anchor = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const dragged = API.createElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 100,
      height: 100,
    });
    API.setElements([anchor, dragged]);

    clickContextMenuItem("objectsSnapMode");
    expect(h.state.objectsSnapModeEnabled).toBe(true);

    API.setSelectedElements([dragged]);

    mouse.reset();
    mouse.downAt(250, 250);
    mouse.moveTo(250, 155);
    mouse.up();

    // dragged to 105 -> snapped onto the anchor's bottom edge
    expect(h.elements[1].y).toBe(100);
  });

  it("zen mode and the stats panel toggle from the context menu", () => {
    expect(h.state.zenModeEnabled).toBe(false);
    clickContextMenuItem("zenMode");
    expect(h.state.zenModeEnabled).toBe(true);

    expect(h.state.stats.open).toBe(false);
    clickContextMenuItem("stats");
    expect(h.state.stats.open).toBe(true);
    expect(h.state.stats.panels & STATS_PANELS.generalStats).toBeTruthy();
  });

  it("the toggles answer their keyboard shortcuts", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.codePress(CODES.QUOTE);
    });
    expect(h.state.gridModeEnabled).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.codePress(CODES.S);
    });
    expect(h.state.objectsSnapModeEnabled).toBe(true);
    expect(h.state.gridModeEnabled).toBe(false);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.codePress(CODES.Z);
    });
    expect(h.state.zenModeEnabled).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.codePress(CODES.SLASH);
    });
    expect(h.state.stats.open).toBe(true);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.codePress(CODES.R);
    });
    expect(h.state.viewModeEnabled).toBe(true);
  });

  it("the arrow-binding and midpoint-snapping toggles flip their state", () => {
    expect(h.state.bindingPreference).toBe("enabled");
    clickContextMenuItem("arrowBinding");
    expect(h.state.bindingPreference).toBe("disabled");
    expect(h.state.isBindingEnabled).toBe(false);

    expect(h.state.isMidpointSnappingEnabled).toBe(true);
    clickContextMenuItem("midpointSnapping");
    expect(h.state.isMidpointSnappingEnabled).toBe(false);
  });

  it("ctrl-drag disables binding until Ctrl is released, even mid-drag", () => {
    UI.clickTool("arrow");

    mouse.reset();
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(0, 0);
    });
    expect(h.state.isBindingEnabled).toBe(false);

    mouse.moveTo(50, 50);
    expect(h.state.isBindingEnabled).toBe(false);

    Keyboard.keyUp("Control");
    expect(h.state.isBindingEnabled).toBe(true);

    mouse.up();
  });

  it("marks checked toggles in the context menu", () => {
    clickContextMenuItem("gridMode");

    const item = openCanvasContextMenu().querySelector(
      'li[data-testid="gridMode"] .context-menu-item',
    )!;
    expect(item.classList).toContain("checkmark");
    expect(
      openCanvasContextMenu().querySelector(
        'li[data-testid="gridMode"] .context-menu-item__shortcut',
      )!.textContent,
    ).not.toBe("");
  });
});
