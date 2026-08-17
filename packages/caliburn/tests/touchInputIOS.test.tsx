import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../src/index";

import { act, GlobalTestState, render, unmountComponent } from "./test-utils";

// the Apple Pencil Scribble fix is the one branch that reads `isIOS`, a
// vendored module constant computed at import time
vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  const { mockThrottleRAF } = await import("./helpers/mocks");

  return {
    __esmodule: true,
    ...module,
    isIOS: true,
    throttleRAF: mockThrottleRAF,
  };
});

unmountComponent();

const dispatchTouchStart = () => {
  const event = new TouchEvent("touchstart", {
    bubbles: true,
    cancelable: true,
    touches: [{ clientX: 100, clientY: 120 } as Touch],
  });
  act(() => {
    GlobalTestState.interactiveCanvas.dispatchEvent(event);
  });
  return event;
};

describe("touch input on iOS", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("prevents the default touchstart, which needs a non-passive listener", () => {
    expect(dispatchTouchStart().defaultPrevented).toBe(true);
  });
});

describe("touch input on iOS while non-interactive", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw interaction={false} handleKeyboardGlobally />);
  });

  it("leaves the default alone", () => {
    expect(dispatchTouchStart().defaultPrevented).toBe(false);
  });
});
