import { debugDrawLine } from "@excalidraw/element/visualdebug";
import { lineSegment, pointFrom } from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math";

import { UI } from "../../packages/caliburn/tests/helpers/ui";
import { STORAGE_KEYS } from "../src/app_constants";

import { act, fireEvent, render } from "./test-utils";

const { h } = window;

const devEnv = vi.hoisted(() => ({ value: false }));

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  const { mockThrottleRAF } = await import(
    "../../packages/caliburn/tests/helpers/mocks"
  );

  return {
    __esmodule: true,
    ...module,
    throttleRAF: mockThrottleRAF,
    isDevEnv: () => devEnv.value,
  };
});

const openMainMenu = () =>
  act(() => fireEvent.click(document.querySelector(".dropdown-menu-button")!));

const visualDebugItem = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-testid="visual-debug-menu-item"]',
  );

const debugCanvas = () =>
  document.querySelector<HTMLCanvasElement>("caliburn-debug-canvas canvas");

const savedDebugState = () =>
  localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_DEBUG);

describe("visual debugger", () => {
  beforeEach(() => {
    devEnv.value = false;
    delete window.visualDebug;
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_DEBUG);
  });

  afterEach(() => {
    delete window.visualDebug;
  });

  it("does not offer the toggle outside a dev env", async () => {
    await render();
    await openMainMenu();

    expect(visualDebugItem()).toBeNull();
    expect(debugCanvas()).toBeNull();
  });

  it("offers the toggle in a dev env, below the socials", async () => {
    devEnv.value = true;
    await render();
    await openMainMenu();

    const item = visualDebugItem();
    expect(item).not.toBeNull();
    expect(item!.textContent!.trim()).toBe("Visual Debug");
    // upstream's `eyeIcon`
    expect(
      item!.querySelector('svg path[d^="M21 12c-2.4 4 -5.4 6 -9 6"]'),
    ).not.toBeNull();

    const container = document.querySelector(".dropdown-menu-container")!;
    const children = [...container.children];
    expect(children.indexOf(item!)).toBe(
      children.findIndex((child) => child.tagName === "CALIBURN-MENU-SOCIALS") +
        1,
    );
  });

  it("toggling flips window.visualDebug, persists it and mounts the canvas", async () => {
    devEnv.value = true;
    await render();
    await openMainMenu();

    expect(window.visualDebug).toBeUndefined();
    expect(debugCanvas()).toBeNull();

    await act(() => fireEvent.click(visualDebugItem()!));

    expect(window.visualDebug).toEqual({ data: [] });
    expect(savedDebugState()).toBe(JSON.stringify({ enabled: true }));

    const canvas = debugCanvas();
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBe(h.state.width * window.devicePixelRatio);
    expect(canvas!.height).toBe(h.state.height * window.devicePixelRatio);
    expect(canvas!.style.width).toBe(`${h.state.width}px`);
    expect(canvas!.style.height).toBe(`${h.state.height}px`);

    await openMainMenu();
    await act(() => fireEvent.click(visualDebugItem()!));

    expect(window.visualDebug).toBeUndefined();
    expect(savedDebugState()).toBe(JSON.stringify({ enabled: false }));
    expect(debugCanvas()).toBeNull();
  });

  it("restores a saved enabled state on startup", async () => {
    devEnv.value = true;
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEBUG,
      JSON.stringify({ enabled: true }),
    );

    await render();

    expect(window.visualDebug).toEqual({ data: [] });
    expect(debugCanvas()).not.toBeNull();
  });

  it("leaves a saved enabled state alone outside a dev env", async () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEBUG,
      JSON.stringify({ enabled: true }),
    );

    await render();

    expect(window.visualDebug).toBeUndefined();
    expect(debugCanvas()).toBeNull();
  });

  it("paints the frames the vendored debug helpers push, on scene change", async () => {
    devEnv.value = true;
    await render();
    await openMainMenu();
    await act(() => fireEvent.click(visualDebugItem()!));

    const canvas = debugCanvas()!;
    const context = canvas.getContext("2d") as any;

    debugDrawLine(
      lineSegment(
        pointFrom<GlobalPoint>(120, 140),
        pointFrom<GlobalPoint>(220, 240),
      ),
      { color: "red", permanent: true },
    );

    UI.createElement("rectangle", { x: 10, y: 10 });

    const events = context.__getEvents();
    expect(
      events.some(
        (event: any) =>
          event.type === "moveTo" &&
          event.props.x === 120 &&
          event.props.y === 140,
      ),
    ).toBe(true);
    expect(
      events.some(
        (event: any) =>
          event.type === "lineTo" &&
          event.props.x === 220 &&
          event.props.y === 240,
      ),
    ).toBe(true);
  });

  it("renders the frame stepper in the footer while enabled", async () => {
    devEnv.value = true;
    await render();

    expect(document.querySelector("caliburn-debug-footer")).toBeNull();

    await openMainMenu();
    await act(() => fireEvent.click(visualDebugItem()!));

    const stepper = document.querySelector("caliburn-debug-footer")!;
    expect(stepper).not.toBeNull();
    expect(stepper.querySelectorAll("button").length).toBe(4);

    // the last button is upstream's "move forward"
    await act(() =>
      fireEvent.click(stepper.querySelector('[data-testid="debug-backward"]')!),
    );
    expect(window.visualDebug!.currentFrame).toBe(1);

    await openMainMenu();
    await act(() => fireEvent.click(visualDebugItem()!));
    expect(document.querySelector("caliburn-debug-footer")).toBeNull();
  });
});
