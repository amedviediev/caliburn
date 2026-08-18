import {
  BIND_MODE_TIMEOUT,
  KEYS,
  reseed,
  setFeatureFlag,
} from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, GlobalTestState, render } from "./test-utils";

const mouse = new Pointer("mouse");

const arrow = () =>
  h.elements.find((el) => el.type === "arrow") as ExcalidrawArrowElement;

const arrowById = (id: ExcalidrawElement["id"]) =>
  h.elements.find((el) => el.id === id) as ExcalidrawArrowElement;

/** the timeout the bind-mode countdown is advanced through */
const fakeTimers = () =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const pressAlt = (down: boolean) => {
  Keyboard.withModifierKeys({ alt: down }, () => {
    if (down) {
      Keyboard.keyDown(KEYS.ALT);
    } else {
      Keyboard.keyUp(KEYS.ALT);
    }
  });
};

const pressCtrl = (down: boolean) => {
  Keyboard.withModifierKeys({ ctrl: down }, () => {
    if (down) {
      Keyboard.keyDown("Control");
    } else {
      Keyboard.keyUp("Control");
    }
  });
};

/** an arrow whose end point is grabbed and dragged into the rectangle */
const draggedArrowEndpoint = () => {
  const rectangle = API.createElement({
    type: "rectangle",
    x: 200,
    y: 100,
    width: 200,
    height: 200,
  });
  const dragged = API.createElement({
    type: "arrow",
    x: 50,
    y: 150,
    width: 60,
    height: 0,
    points: [pointFrom(0, 0), pointFrom(60, 0)],
  });
  API.setElements([rectangle, dragged]);
  mouse.clickAt(80, 150);
  mouse.moveTo(110, 150);
  expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(1);

  mouse.downAt(110, 150);
  mouse.moveTo(300, 200);

  return { arrow: dragged, rectangle };
};

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
  setFeatureFlag("COMPLEX_BINDINGS", true);
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});

afterEach(() => {
  vi.useRealTimers();
  setFeatureFlag("COMPLEX_BINDINGS", false);
});

describe("delayed bind mode", () => {
  it("switches to inside binding after hovering a bindable for the timeout", () => {
    UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
    fakeTimers();

    UI.clickTool("arrow");
    mouse.downAt(50, 200);
    mouse.moveTo(200, 200);

    expect(h.state.bindMode).toBe("orbit");

    advance(BIND_MODE_TIMEOUT);

    expect(h.state.bindMode).toBe("inside");
    expect(h.app.bindModeHandler).toBe(null);
    expect(arrow().endBinding?.mode).toBe("inside");
  });

  it("cancels the countdown when the pointer leaves the bindable", () => {
    UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
    fakeTimers();

    UI.clickTool("arrow");
    mouse.downAt(50, 200);
    mouse.moveTo(200, 200);
    expect(h.app.bindModeHandler).not.toBe(null);

    mouse.moveTo(500, 500);
    expect(h.app.bindModeHandler).toBe(null);

    advance(BIND_MODE_TIMEOUT);

    expect(h.state.bindMode).toBe("orbit");
  });

  it("does not restart the countdown while already inside-bound to the same element", () => {
    UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
    fakeTimers();

    UI.clickTool("arrow");
    mouse.downAt(50, 200);
    mouse.moveTo(200, 200);
    advance(BIND_MODE_TIMEOUT);
    expect(h.state.bindMode).toBe("inside");

    mouse.moveTo(210, 210);

    expect(h.app.bindModeHandler).toBe(null);
  });

  describe("while creating an arrow that is already start-bound", () => {
    it("arms the countdown when the two bindables overlap", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      UI.createElement("rectangle", { x: 250, y: 250, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.downAt(150, 150);
      expect(arrow().startBinding).not.toBe(null);

      mouse.moveTo(400, 400);
      mouse.moveTo(410, 410);
      advance(BIND_MODE_TIMEOUT);

      expect(h.state.bindMode).toBe("inside");
    });

    it("leaves it disarmed when they do not overlap", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 100 });
      UI.createElement("rectangle", { x: 400, y: 400, size: 100 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.downAt(150, 150);
      expect(arrow().startBinding).not.toBe(null);

      mouse.moveTo(450, 450);
      mouse.moveTo(455, 455);
      expect(h.app.bindModeHandler).toBe(null);

      advance(BIND_MODE_TIMEOUT);

      expect(h.state.bindMode).toBe("orbit");
    });

    it("remembers the bindable the pointer went down on", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      UI.createElement("rectangle", { x: 250, y: 250, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.downAt(150, 150);

      // the first move onto another bindable only re-points the bookkeeping
      mouse.moveTo(400, 400);
      expect(h.app.bindModeHandler).toBe(null);

      mouse.moveTo(410, 410);
      expect(h.app.bindModeHandler).not.toBe(null);
    });
  });

  it("arms the countdown while laying down a multi-point arrow", () => {
    UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
    fakeTimers();

    UI.clickTool("arrow");
    mouse.clickAt(50, 200);
    expect(h.state.multiElement).not.toBe(null);

    mouse.moveTo(200, 200);
    advance(BIND_MODE_TIMEOUT);

    expect(h.state.bindMode).toBe("inside");
  });

  describe("alt", () => {
    it("keydown skips the bind mode and re-routes the arrow", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.downAt(50, 200);
      mouse.moveTo(200, 200);
      expect(h.app.bindModeHandler).not.toBe(null);

      pressAlt(true);

      expect(h.state.bindMode).toBe("skip");
      expect(h.app.bindModeHandler).toBe(null);
      expect(arrow().endBinding?.mode).toBe("inside");
    });

    it("held through a drag over a bindable skips the bind mode", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.downAt(50, 200);
      Keyboard.withModifierKeys({ alt: true }, () => {
        mouse.moveTo(200, 200);
      });

      expect(h.state.bindMode).toBe("skip");
      expect(arrow().endBinding?.mode).toBe("inside");
    });

    it("keyup restores the orbit mode", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.downAt(50, 200);
      mouse.moveTo(200, 200);
      pressAlt(true);
      expect(h.state.bindMode).toBe("skip");

      pressAlt(false);

      expect(h.state.bindMode).toBe("orbit");
    });

    it("keyup leaves the inside binding the skip mode produced", () => {
      fakeTimers();
      const { arrow: dragged } = draggedArrowEndpoint();

      pressAlt(true);
      expect(h.state.bindMode).toBe("skip");
      expect(arrowById(dragged.id).endBinding?.mode).toBe("inside");

      pressAlt(false);

      expect(h.state.bindMode).toBe("orbit");
      expect(arrowById(dragged.id).endBinding?.mode).toBe("inside");
    });
  });

  describe("ctrl", () => {
    it("keydown clears the countdown and defers the orbit restore", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.downAt(50, 200);
      mouse.moveTo(200, 200);
      advance(BIND_MODE_TIMEOUT);
      expect(h.state.bindMode).toBe("inside");

      pressCtrl(true);

      expect(h.app.bindModeHandler).toBe(null);
      expect(h.state.bindMode).toBe("inside");

      advance(0);

      expect(h.state.bindMode).toBe("orbit");
    });

    it("keyup publishes the queued orbit mode before re-running the drag", () => {
      const rectangle = API.createElement({
        type: "rectangle",
        x: 200,
        y: 100,
        width: 200,
        height: 200,
      });
      // an orbit start binding keeps the dragged end from landing inside on
      // the first move, which is what leaves the countdown free to arm
      const dragged = API.createElement({
        type: "arrow",
        x: 250,
        y: 150,
        width: 60,
        height: 0,
        points: [pointFrom(0, 0), pointFrom(60, 0)],
        startBinding: {
          elementId: rectangle.id,
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      });
      API.setElements([rectangle, dragged]);
      mouse.clickAt(280, 150);
      mouse.moveTo(310, 150);
      expect(h.state.selectedLinearElement?.hoverPointIndex).toBe(1);

      mouse.downAt(310, 150);
      fakeTimers();
      mouse.moveTo(350, 200);
      advance(BIND_MODE_TIMEOUT);
      expect(h.state.bindMode).toBe("inside");
      expect(arrowById(dragged.id).endBinding?.mode).toBe("inside");

      // ctrl's own orbit restore is still sitting on its timer, so the
      // release runs with the inside mode standing
      pressCtrl(true);
      expect(h.state.bindMode).toBe("inside");

      pressCtrl(false);

      // upstream's `flushSync` for the binding preference publishes the orbit
      // write queued above it, so the drag the same handler re-runs binds
      // under "orbit" — `binding.ts` then keeps the endpoint orbiting and
      // `linearElementEditor.ts` collapses the end onto the start it is
      // dragged over
      expect(h.state.bindMode).toBe("orbit");
      expect(arrowById(dragged.id).endBinding?.mode).toBe("orbit");
      expect(arrowById(dragged.id).points.at(-1)).toEqual(
        arrowById(dragged.id).points[0],
      );
    });

    it("keyup restarts the countdown while the pointer still hovers", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.downAt(50, 200);
      mouse.moveTo(200, 200);
      pressCtrl(true);
      expect(h.app.bindModeHandler).toBe(null);

      pressCtrl(false);

      expect(h.app.bindModeHandler).not.toBe(null);

      advance(BIND_MODE_TIMEOUT);

      expect(h.state.bindMode).toBe("inside");
    });
  });

  it("pointer up resets the bind mode and the countdown", () => {
    UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
    fakeTimers();

    UI.clickTool("arrow");
    mouse.downAt(50, 200);
    mouse.moveTo(200, 200);
    advance(BIND_MODE_TIMEOUT);
    expect(h.state.bindMode).toBe("inside");

    mouse.moveTo(500, 500);
    mouse.moveTo(200, 200);
    expect(h.app.bindModeHandler).not.toBe(null);

    mouse.up();

    expect(h.app.bindModeHandler).toBe(null);
    expect(h.state.bindMode).toBe("orbit");
  });

  describe("turning the editor non-interactive", () => {
    // a multi-point arrow keeps the countdown alive between clicks, with no
    // pointer session for the teardown's replayed pointer up to end
    it("clears a countdown no pointer up would", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.clickAt(50, 200);
      mouse.moveTo(200, 200);
      expect(h.app.bindModeHandler).not.toBe(null);

      GlobalTestState.renderResult.rerender(
        <Excalidraw interaction={false} handleKeyboardGlobally={true} />,
      );

      expect(h.app.bindModeHandler).toBe(null);
    });

    it("restores the orbit mode", () => {
      UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
      fakeTimers();

      UI.clickTool("arrow");
      mouse.clickAt(50, 200);
      mouse.moveTo(200, 200);
      advance(BIND_MODE_TIMEOUT);
      expect(h.state.bindMode).toBe("inside");

      GlobalTestState.renderResult.rerender(
        <Excalidraw interaction={false} handleKeyboardGlobally={true} />,
      );

      expect(h.state.bindMode).toBe("orbit");
    });
  });
});

describe("delayed bind mode with COMPLEX_BINDINGS off", () => {
  beforeEach(() => {
    setFeatureFlag("COMPLEX_BINDINGS", false);
  });

  it("never arms the countdown nor leaves orbit", () => {
    UI.createElement("rectangle", { x: 100, y: 100, size: 200 });
    fakeTimers();

    UI.clickTool("arrow");
    mouse.downAt(50, 200);
    mouse.moveTo(200, 200);

    expect(h.app.bindModeHandler).toBe(null);

    advance(BIND_MODE_TIMEOUT);

    expect(h.state.bindMode).toBe("orbit");

    pressAlt(true);

    expect(h.state.bindMode).toBe("orbit");
  });
});
