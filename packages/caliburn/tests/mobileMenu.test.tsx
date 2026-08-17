import { Excalidraw } from "../src";

import { h } from "../src/test-hook";

import { UI } from "./helpers/ui";
import {
  act,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

/**
 * Port of upstream's `excalidraw-app/tests/MobileMenu.test.tsx`. Upstream
 * composes an explicit `<WelcomeScreen />` child; caliburn's editor renders
 * the same default welcome screen without one (`layer-ui.component.html` and
 * `mobile-menu.component.html` both fall back to it), so the child is dropped.
 *
 * The markup snapshot is caliburn-recorded rather than reused from upstream:
 * the welcome screen's DOM is the Angular port's own (custom-element hosts,
 * `<ng-icon>` wrappers around the same SVGs, comment anchors for the control
 * flow blocks). What it pins is what upstream's pins — that the editor starts
 * on the welcome screen's logo, heading and menu, and that it disappears on
 * the first tool click. As upstream, `refreshEditorInterface` is called bare:
 * it writes no component state, so neither React nor Angular has re-rendered
 * into the phone layout by the time the snapshot is taken.
 */
describe("Test MobileMenu", () => {
  const dimensions = { height: 400, width: 800 };

  beforeAll(() => {
    mockBoundingClientRect(dimensions);
  });

  beforeEach(async () => {
    await render(<Excalidraw />);
    h.app.refreshEditorInterface();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should set editor interface correctly", () => {
    expect(h.app.editorInterface.formFactor).toBe("phone");
  });

  it("should initialize with welcome screen and hide once user interacts", async () => {
    expect(document.querySelector(".welcome-screen-center")).toMatchSnapshot();
    UI.clickTool("rectangle");
    expect(document.querySelector(".welcome-screen-center")).toBeNull();
  });
});

describe("mobile layout", () => {
  beforeEach(async () => {
    mockBoundingClientRect({ width: 400, height: 800 });
    await render(<Excalidraw />);
    act(() => h.app.refreshEditorInterface());
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("replaces the desktop layout with the mobile one", () => {
    expect(document.querySelector(".App-bottom-bar")).not.toBeNull();
    expect(document.querySelector(".mobile-toolbar")).not.toBeNull();
    expect(document.querySelector(".App-top-bar")).not.toBeNull();
    expect(document.querySelector(".layer-ui__wrapper")).toBeNull();
    expect(
      document
        .querySelector(".excalidraw")!
        .classList.contains("excalidraw--mobile"),
    ).toBe(true);
  });

  it("renders the mobile styles panel and its undo/redo column", () => {
    expect(document.querySelector(".mobile-shape-actions")).not.toBeNull();
    expect(
      document.querySelector(
        '.mobile-shape-actions [data-testid="button-undo"]',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        '.mobile-shape-actions [data-testid="button-redo"]',
      ),
    ).not.toBeNull();
  });

  it("groups the generic shapes behind a tool popover", () => {
    const trigger = document.querySelector<HTMLButtonElement>(
      '.mobile-toolbar [data-testid="toolbar-rectangle"]',
    )!;
    expect(trigger).not.toBeNull();

    act(() => trigger.click());
    expect(h.state.activeTool.type).toBe("rectangle");

    const option = document.querySelector<HTMLButtonElement>(
      '.tool-popover-content [data-testid="toolbar-ellipse"]',
    )!;
    expect(option).not.toBeNull();

    act(() => option.click());
    expect(h.state.activeTool.type).toBe("ellipse");
  });
});
