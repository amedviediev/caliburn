import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import { Excalidraw } from "../src";

import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";

import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

/**
 * Caliburn-authored: upstream ships no behavioural test for pen mode at the
 * pinned commit (only appState snapshots carry `penMode`/`penDetected`), so
 * the whole surface it does ship — `PenModeButton`, `App.togglePenMode`, the
 * canvas pen-detection block, the tool-button pen rule and the touch guard on
 * pointer-down — is pinned here.
 */

const penModeButtons = () =>
  Array.from(document.querySelectorAll<HTMLElement>(".ToolIcon__penMode"));

const penDown = () => {
  const pen = new Pointer("pen");
  pen.down(50, 50);
  pen.up();
};

describe("pen detection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("starts undetected, with the button hidden", () => {
    expect(h.state.penDetected).toBe(false);
    expect(h.state.penMode).toBe(false);
    expect(penModeButtons()).toHaveLength(0);
  });

  it("enables pen mode on the first pen pointer-down and reveals the button", () => {
    penDown();

    expect(h.state.penDetected).toBe(true);
    expect(h.state.penMode).toBe(true);
    expect(h.state.currentItemStrokeVariability).toBe("variable");
    expect(penModeButtons()).toHaveLength(1);
  });

  it("does not fire for mouse or touch pointers", () => {
    const mouse = new Pointer("mouse");
    mouse.down(50, 50);
    mouse.up();

    const touch = new Pointer("touch");
    touch.down(60, 60);
    touch.up();

    expect(h.state.penDetected).toBe(false);
    expect(h.state.penMode).toBe(false);
    expect(penModeButtons()).toHaveLength(0);
  });

  it("fires only once — a later pen down does not re-enable a disabled pen mode", () => {
    penDown();
    act(() => h.app.togglePenMode(false));
    expect(h.state.penMode).toBe(false);
    expect(h.state.currentItemStrokeVariability).toBe("variable");

    act(() => API.setAppState({ currentItemStrokeVariability: "constant" }));
    penDown();

    expect(h.state.penMode).toBe(false);
    expect(h.state.currentItemStrokeVariability).toBe("constant");
  });
});

describe("togglePenMode", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("flips pen mode and marks the pen detected when called with null", () => {
    act(() => h.app.togglePenMode(null));

    expect(h.state.penMode).toBe(true);
    expect(h.state.penDetected).toBe(true);
    // first detection also switches freedraw to variable-width strokes
    expect(h.state.currentItemStrokeVariability).toBe("variable");

    act(() => h.app.togglePenMode(null));

    expect(h.state.penMode).toBe(false);
    expect(h.state.penDetected).toBe(true);
  });

  it("honours a forced value and leaves the stroke variability alone once detected", () => {
    act(() => h.app.togglePenMode(true));
    act(() => API.setAppState({ currentItemStrokeVariability: "constant" }));

    act(() => h.app.togglePenMode(true));

    expect(h.state.penMode).toBe(true);
    expect(h.state.currentItemStrokeVariability).toBe("constant");

    act(() => h.app.togglePenMode(false));

    expect(h.state.penMode).toBe(false);
    expect(h.state.penDetected).toBe(true);
  });
});

describe("pen mode button", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("toggles pen mode on click and reflects the pressed state", () => {
    penDown();

    const [button] = penModeButtons();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.classList.contains("ToolIcon--checked")).toBe(true);
    expect(button.getAttribute("title")).toBe("Pen mode - prevent touch");
    expect(button.getAttribute("aria-label")).toBe("Pen mode - prevent touch");

    fireEvent.click(button);

    expect(h.state.penMode).toBe(false);
    expect(h.state.penDetected).toBe(true);
    const [afterButton] = penModeButtons();
    expect(afterButton.getAttribute("aria-pressed")).toBe("false");
    expect(afterButton.classList.contains("ToolIcon--checked")).toBe(false);

    fireEvent.click(afterButton);

    expect(h.state.penMode).toBe(true);
  });

  it("sits in the desktop toolbar island, without the mobile modifier", () => {
    penDown();

    const [button] = penModeButtons();
    expect(button.closest(".App-toolbar")).not.toBeNull();
    expect(button.classList.contains("is-mobile")).toBe(false);
  });
});

describe("tool buttons detect the pen", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("turns pen mode on when a tool is picked with a pen", () => {
    const button = document.querySelector<HTMLElement>(
      '[data-testid="toolbar-rectangle"]',
    )!;

    fireEvent.pointerDown(button, { pointerType: "pen" });
    fireEvent.click(button);

    expect(h.state.penMode).toBe(true);
    expect(h.state.penDetected).toBe(true);
    expect(h.state.activeTool.type).toBe("rectangle");
  });

  it("leaves pen mode alone for a mouse", () => {
    const button = document.querySelector<HTMLElement>(
      '[data-testid="toolbar-rectangle"]',
    )!;

    fireEvent.pointerDown(button, { pointerType: "mouse" });
    fireEvent.click(button);

    expect(h.state.penMode).toBe(false);
    expect(h.state.penDetected).toBe(false);
    expect(h.state.activeTool.type).toBe("rectangle");
  });

  it("does not re-enable pen mode the user turned off", () => {
    act(() => h.app.togglePenMode(false));

    const button = document.querySelector<HTMLElement>(
      '[data-testid="toolbar-rectangle"]',
    )!;
    fireEvent.pointerDown(button, { pointerType: "pen" });
    fireEvent.click(button);

    expect(h.state.penMode).toBe(false);
  });
});

describe("pen mode ignores touch on the canvas", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    act(() => h.app.togglePenMode(true));
  });

  it("does not draw with a finger", () => {
    UI.clickTool("freedraw");

    const touch = new Pointer("touch");
    touch.down(50, 50);
    touch.move(20, 20);
    touch.up();

    expect(h.elements).toHaveLength(0);
  });

  it("still draws with a pen", () => {
    UI.clickTool("freedraw");

    const pen = new Pointer("pen");
    pen.down(50, 50);
    pen.move(20, 20);
    pen.up();

    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].type).toBe("freedraw");
  });

  it("still selects with a finger", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffc9c9",
      fillStyle: "solid",
    });
    act(() => API.setElements([rectangle]));

    const touch = new Pointer("touch");
    touch.down(50, 50);
    touch.up();

    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
  });
});

describe("pen mode button placements", () => {
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("floats below the compact styles panel on a tablet", async () => {
    mockBoundingClientRect({ width: 900, height: 900 });
    await render(<Excalidraw />);
    act(() => h.app.refreshEditorInterface());

    act(() => h.app.togglePenMode(true));
    // no drawing tool and nothing selected — the compact styles panel, and
    // with it the floating button, stays hidden
    expect(penModeButtons()).toHaveLength(0);

    UI.clickTool("rectangle");

    const [button] = penModeButtons();
    expect(button).toBeDefined();
    expect(button.classList.contains("is-mobile")).toBe(true);
    expect(button.parentElement!.classList.contains("App-menu_top__left")).toBe(
      true,
    );
    // the compact toolbar renders no button of its own
    expect(button.closest(".App-toolbar")).toBeNull();
  });

  it("sits in the mobile top bar on a phone", async () => {
    mockBoundingClientRect({ width: 400, height: 800 });
    await render(<Excalidraw />);
    act(() => h.app.refreshEditorInterface());

    expect(penModeButtons()).toHaveLength(0);

    penDown();

    const [button] = penModeButtons();
    expect(button).toBeDefined();
    expect(button.classList.contains("is-mobile")).toBe(true);
    expect(button.closest(".excalidraw-ui-top-right")).not.toBeNull();
  });
});

describe("pen mode persistence", () => {
  it("is kept in the browser-persisted app state", () => {
    const persisted = clearAppStateForLocalStorage({
      penMode: true,
      penDetected: true,
    });

    expect(persisted.penMode).toBe(true);
    expect(persisted.penDetected).toBe(true);
  });
});
