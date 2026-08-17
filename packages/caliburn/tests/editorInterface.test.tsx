import {
  MQ_MAX_MOBILE,
  MQ_MAX_TABLET,
  MQ_MIN_TABLET,
  MQ_RIGHT_SIDEBAR_MIN_WIDTH,
  deriveStylesPanelMode,
} from "@excalidraw/common";

import { Excalidraw } from "../src";

import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";

import {
  act,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

/**
 * Caliburn-authored: upstream has no test for `refreshEditorInterface` beyond
 * `MobileMenu.test.tsx`'s single phone assertion, so the whole derivation —
 * every breakpoint of `getFormFactor`, the host override, the landscape rule,
 * the sidebar breakpoint, the user-agent descriptor and the styles-panel mode
 * transitions — is pinned here, driven through the real method exactly as
 * `withExcalidrawDimensions` drives it.
 *
 * One field of the user-agent descriptor can only be pinned in the browser:
 * `isMobileDevice` resolves through the vendored `isIOS`/`isAndroid` flags,
 * which `@excalidraw/common` evaluates once at import time, so redefining
 * `navigator.userAgent` mid-suite cannot move it. `platform` still follows the
 * live string, and the mobile-device answer is asserted under real phone
 * emulation in the e2e suite's mobile group instead.
 */
const resizeTo = (dimensions: { width: number; height: number }) => {
  mockBoundingClientRect(dimensions);
  act(() => h.app.refreshEditorInterface());
};

/** a fixed rect for one specific node, leaving every other node's alone */
const stubRect = (
  element: Element,
  rect: { left: number; top: number; width: number; height: number },
) => {
  element.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      toJSON: () => {},
    } as DOMRect);
};

describe("editorInterface derivation", () => {
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("starts at the desktop defaults before the container is measured", async () => {
    await render(<Excalidraw />);

    expect(h.app.editorInterface.formFactor).toBe("desktop");
    expect(h.app.editorInterface.desktopUIMode).toBe("full");
    expect(h.app.editorInterface.canFitSidebar).toBe(false);
    expect(h.app.editorInterface.isLandscape).toBe(true);
  });

  it.each([
    // a narrow enough editor is a phone at any height
    [{ width: MQ_MAX_MOBILE, height: 2000 }, "phone"],
    // …as is a short one that isn't wide enough to escape the landscape rule
    [{ width: 999, height: 499 }, "phone"],
    // one pixel wider clears `MQ_MAX_WIDTH_LANDSCAPE`
    [{ width: 1000, height: 499 }, "desktop"],
    // both sides inside the tablet band
    [{ width: MQ_MIN_TABLET, height: MQ_MIN_TABLET }, "tablet"],
    [{ width: MQ_MAX_TABLET, height: MQ_MIN_TABLET }, "tablet"],
    // the long side leaving the band drops back to desktop
    [{ width: MQ_MAX_TABLET + 1, height: MQ_MIN_TABLET }, "desktop"],
    [{ width: 1920, height: 1080 }, "desktop"],
  ] as const)("derives %o as %s", async (dimensions, formFactor) => {
    await render(<Excalidraw />);
    resizeTo(dimensions);

    expect(h.app.editorInterface.formFactor).toBe(formFactor);
  });

  it("derives isLandscape and canFitSidebar from the same rect", async () => {
    await render(<Excalidraw />);

    resizeTo({ width: MQ_RIGHT_SIDEBAR_MIN_WIDTH, height: 900 });
    expect(h.app.editorInterface.canFitSidebar).toBe(false);
    expect(h.app.editorInterface.isLandscape).toBe(true);

    resizeTo({ width: MQ_RIGHT_SIDEBAR_MIN_WIDTH + 1, height: 900 });
    expect(h.app.editorInterface.canFitSidebar).toBe(true);

    resizeTo({ width: 800, height: 1600 });
    expect(h.app.editorInterface.isLandscape).toBe(false);
  });

  it("honours the host's UIOptions.getFormFactor over the breakpoints", async () => {
    await render(<Excalidraw UIOptions={{ getFormFactor: () => "tablet" }} />);

    resizeTo({ width: 1920, height: 1080 });

    expect(h.app.editorInterface.formFactor).toBe("tablet");
    expect(deriveStylesPanelMode(h.app.editorInterface)).toBe("compact");
    // the measured fields are still derived from the real rect
    expect(h.app.editorInterface.canFitSidebar).toBe(true);
  });

  it("reads isMobileDevice off the user agent", async () => {
    await render(<Excalidraw />);

    resizeTo({ width: 1920, height: 1080 });
    expect(h.app.editorInterface.userAgent.isMobileDevice).toBe(false);
    expect(h.app.editorInterface.userAgent.platform).toBe("other");

    const original = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "",
    });
    try {
      resizeTo({ width: 1919, height: 1080 });
      expect(h.app.editorInterface.userAgent.platform).toBe("unknown");
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: original,
      });
    }
  });
});

describe("stylesPanelMode transitions", () => {
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("follows the form factor", async () => {
    await render(<Excalidraw />);

    resizeTo({ width: 400, height: 800 });
    expect(deriveStylesPanelMode(h.app.editorInterface)).toBe("mobile");

    resizeTo({ width: 900, height: 900 });
    expect(deriveStylesPanelMode(h.app.editorInterface)).toBe("compact");

    resizeTo({ width: 1920, height: 1080 });
    expect(deriveStylesPanelMode(h.app.editorInterface)).toBe("full");
  });

  it("resets the preferred selection tool on the way into full", async () => {
    await render(<Excalidraw />);

    resizeTo({ width: 400, height: 800 });
    act(() =>
      h.app.setState({
        preferredSelectionTool: { type: "lasso", initialized: true },
      }),
    );
    expect(h.state.preferredSelectionTool.type).toBe("lasso");

    // mobile → compact is not an entry into "full": the compact toolbar can
    // still switch the preferred tool, so the choice survives
    resizeTo({ width: 900, height: 900 });
    expect(h.state.preferredSelectionTool.type).toBe("lasso");

    resizeTo({ width: 1920, height: 1080 });
    expect(h.state.preferredSelectionTool).toEqual({
      type: "selection",
      initialized: true,
    });
  });

  it("invalidates the viewport's measured stylesPanel offset on a transition", async () => {
    await render(<Excalidraw />);

    const invalidated: string[] = [];
    const original = h.app.viewport.invalidateUIOffset;
    h.app.viewport.invalidateUIOffset = ((name: string) => {
      invalidated.push(name);
      return original.call(h.app.viewport, name as never);
    }) as typeof original;

    try {
      resizeTo({ width: 900, height: 900 });
      expect(invalidated).toEqual(["stylesPanel"]);

      // no transition, no invalidation
      resizeTo({ width: 901, height: 900 });
      expect(invalidated).toEqual(["stylesPanel"]);
    } finally {
      h.app.viewport.invalidateUIOffset = original;
    }
  });
});

describe("isTouchScreen", () => {
  it("latches on the first touch or pen pointer down", async () => {
    await render(<Excalidraw />);

    expect(h.app.editorInterface.isTouchScreen).toBe(false);

    // a mouse says nothing about the screen
    const mouse = new Pointer("mouse");
    act(() => mouse.down(50, 50));
    act(() => mouse.up());
    expect(h.app.editorInterface.isTouchScreen).toBe(false);

    const finger = new Pointer("touch", 2);
    act(() => finger.down(60, 60));
    act(() => finger.up());
    expect(h.app.editorInterface.isTouchScreen).toBe(true);
  });

  it("latches on a pen pointer down too", async () => {
    await render(<Excalidraw />);

    const pen = new Pointer("pen", 3);
    act(() => pen.down(60, 60));
    act(() => pen.up());
    expect(h.app.editorInterface.isTouchScreen).toBe(true);
  });
});

describe("the styles panel as a viewport surface", () => {
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  /** renders the panel by putting a selected element on the scene */
  const withSelectedElement = () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    act(() => {
      API.setElements([rectangle]);
      API.setAppState({
        selectedElementIds: { [rectangle.id]: true },
        width: 1000,
        height: 800,
      });
    });
  };

  const measurePanel = (selector: string) => {
    const container = document.querySelector(".excalidraw")!;
    stubRect(container, { left: 0, top: 0, width: 1000, height: 800 });
    const panel = document.querySelector(selector);
    expect(panel).not.toBeNull();
    stubRect(panel!, { left: 8, top: 100, width: 200, height: 400 });
  };

  it("reports the full panel's own footprint, measured not reserved", async () => {
    await render(<Excalidraw />);
    resizeTo({ width: 1920, height: 1080 });
    withSelectedElement();

    measurePanel('[data-viewport-ui-name="stylesPanel"]');

    // left edge 8 + width 200 — the panel's real right edge, not the
    // `STYLES_PANEL_APPROX_WIDTH.full` fallback (216)
    expect(h.app.viewport.getOffsets({ padding: 0 }).left).toBe(208);
    // and because the surface was seen, reserving it adds nothing on top
    expect(
      h.app.viewport.getOffsets({ padding: 0, reserve: { stylesPanel: true } })
        .left,
    ).toBe(208);
  });

  it("reports the compact panel's footprint on a tablet", async () => {
    await render(<Excalidraw />);
    resizeTo({ width: 900, height: 900 });
    withSelectedElement();

    measurePanel(
      '.compact-shape-actions-island[data-viewport-ui-name="stylesPanel"]',
    );

    expect(h.app.viewport.getOffsets({ padding: 0 }).left).toBe(208);
    expect(
      h.app.viewport.getOffsets({ padding: 0, reserve: { stylesPanel: true } })
        .left,
    ).toBe(208);
  });

  it("falls back to the reserved approximation while the panel is hidden", async () => {
    await render(<Excalidraw />);
    resizeTo({ width: 1920, height: 1080 });
    act(() => API.setAppState({ width: 1000, height: 800 }));

    const container = document.querySelector(".excalidraw")!;
    stubRect(container, { left: 0, top: 0, width: 1000, height: 800 });
    expect(
      document.querySelector('[data-viewport-ui-name="stylesPanel"]'),
    ).toBeNull();

    expect(h.app.viewport.getOffsets({ padding: 0 }).left).toBe(0);
    expect(
      h.app.viewport.getOffsets({ padding: 0, reserve: { stylesPanel: true } })
        .left,
    ).toBe(216);
  });
});
