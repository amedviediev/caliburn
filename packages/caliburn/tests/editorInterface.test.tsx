import {
  MQ_MAX_MOBILE,
  MQ_MAX_TABLET,
  MQ_MIN_TABLET,
  MQ_RIGHT_SIDEBAR_MIN_WIDTH,
  deriveStylesPanelMode,
} from "@excalidraw/common";

import { Excalidraw } from "../src";

import { h } from "../src/test-hook";

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
 */
const resizeTo = (dimensions: { width: number; height: number }) => {
  mockBoundingClientRect(dimensions);
  act(() => h.app.refreshEditorInterface());
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
