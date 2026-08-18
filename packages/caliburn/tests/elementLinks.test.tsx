import React from "react";

import { KEYS } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  GlobalTestState,
  act,
  fireEvent,
  render,
  unmountComponent,
} from "./test-utils";

import type { RenderResult } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

unmountComponent();

let renderResult: RenderResult;

const popup = () =>
  renderResult.container.querySelector<HTMLElement>(
    ".excalidraw-hyperlinkContainer",
  );

const popupInput = () =>
  renderResult.container.querySelector<HTMLInputElement>(
    ".excalidraw-hyperlinkContainer-input",
  );

const dialog = () =>
  renderResult.container.querySelector<HTMLElement>(".ElementLinkDialog");

const selectRectangle = () => {
  const rectangle = API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  API.setElements([rectangle]);
  API.setSelectedElements([rectangle]);
  return rectangle;
};

/**
 * The link icon sits at the element's top-right corner
 * (`getLinkHandleFromCoords`): at zoom 1 its 12x12 box starts at
 * `x2 + 2` / `y1 - 14`.
 */
const linkIconCenter = (x2: number, y1: number) => ({
  x: x2 + 2 + 6,
  y: y1 - 14 + 6,
});

/** `EditorInterface.isTouchScreen` is readonly on the type but per-instance */
const forceTouchScreen = () => {
  (h.app.editorInterface as { isTouchScreen: boolean }).isTouchScreen = true;
};

const linkedRectangle = () => ({
  // `API.createElement` drops `link`, so it is set on the plain element
  ...API.createElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  }),
  link: "https://example.com",
});

describe("element links", () => {
  beforeEach(async () => {
    renderResult = await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("CtrlOrCmd+K opens the link editor for a single selected element", () => {
    selectRectangle();
    expect(popup()).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.K);
    });

    expect(h.state.showHyperlinkPopup).toBe("editor");
    expect(popup()).not.toBeNull();
    expect(popupInput()).not.toBeNull();
  });

  it("the link editor writes the link onto the element", () => {
    const rectangle = selectRectangle();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.K);
    });

    const input = popupInput()!;
    act(() => {
      fireEvent.input(input, { target: { value: "https://example.com" } });
      fireEvent.keyDown(input, { key: KEYS.ENTER });
    });

    expect(h.state.showHyperlinkPopup).toBe("info");
    expect(h.elements[0].id).toBe(rectangle.id);
    expect(h.elements[0].link).toBe("https://example.com");
  });

  it("the popup's Edit button focuses and selects the link input", () => {
    const rectangle = {
      // `API.createElement` drops `link`, so it is set on the plain element
      ...API.createElement({ type: "rectangle", width: 100, height: 100 }),
      link: "https://example.com",
    };
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    act(() => {
      API.setAppState({ showHyperlinkPopup: "info" });
    });

    expect(popupInput()).toBeNull();

    act(() => {
      fireEvent.click(
        renderResult.container.querySelector<HTMLButtonElement>(
          ".excalidraw-hyperlinkContainer--edit",
        )!,
      );
    });

    const input = popupInput()!;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("https://example.com".length);
  });

  it("the link popup's remove button clears the link", () => {
    const rectangle = {
      // `API.createElement` drops `link`, so it is set on the plain element
      ...API.createElement({ type: "rectangle", width: 100, height: 100 }),
      link: "https://example.com",
    };
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    act(() => {
      API.setAppState({ showHyperlinkPopup: "info" });
    });

    const remove = renderResult.container.querySelector<HTMLButtonElement>(
      ".excalidraw-hyperlinkContainer--remove",
    )!;
    expect(remove).not.toBeNull();

    act(() => {
      fireEvent.click(remove);
    });

    expect(h.elements[0].link).toBeNull();
    expect(h.state.showHyperlinkPopup).toBe(false);
  });

  it("the context menu offers the link actions for a selected element", () => {
    selectRectangle();

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    const contextMenu = UI.queryContextMenu();
    expect(
      contextMenu?.querySelector(`li[data-testid="hyperlink"]`),
    ).not.toBeNull();
    expect(
      contextMenu?.querySelector(`li[data-testid="copyElementLink"]`),
    ).not.toBeNull();
  });

  it("tapping a link icon opens the link when links are enabled", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const rectangle = linkedRectangle();

    API.setElements([rectangle]);
    forceTouchScreen();

    const { x, y } = linkIconCenter(200, 100);
    act(() => {
      mouse.clickAt(x, y);
    });

    expect(open).toHaveBeenCalled();
  });

  it("tears the gesture down when only the release lands on a link icon", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const rectangle = linkedRectangle();
    API.setElements([rectangle]);
    forceTouchScreen();

    // the press opens a gesture on empty canvas, well clear of the element,
    // and only the release re-derives the link hit — upstream's canvas
    // handler ends there, its window listener still tears the gesture down
    const { x, y } = linkIconCenter(200, 100);
    act(() => {
      mouse.downAt(500, 500);
      mouse.moveTo(x, y);
      mouse.upAt(x, y);
    });

    expect(h.state.selectionElement).toBe(null);
    expect(h.state.cursorButton).toBe("up");
  });

  it("the element-link dialog links the source element to the selection", () => {
    const source = API.createElement({ type: "rectangle", width: 100 });
    const target = API.createElement({
      type: "rectangle",
      x: 200,
      width: 100,
    });
    API.setElements([source, target]);
    act(() => {
      API.setAppState({
        selectedElementIds: { [target.id]: true },
        openDialog: { name: "elementLinkSelector", sourceElementId: source.id },
      });
    });

    expect(dialog()).not.toBeNull();

    const confirm = renderResult.container.querySelector<HTMLButtonElement>(
      `.ElementLinkDialog__actions [aria-label="${t("buttons.confirm")}"]`,
    )!;
    act(() => {
      fireEvent.click(confirm);
    });

    expect(h.state.openDialog).toBeNull();
    expect(h.elements[0].link).toContain(target.id);
  });

  describe("the link target's dim affordance", () => {
    /** opens the selector on a source element, with `target` to hover */
    const pickingFor = (groupIds: string[] = []) => {
      const source = API.createElement({ type: "rectangle", width: 100 });
      const target = API.createElement({
        type: "rectangle",
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        backgroundColor: "#ffec99",
        groupIds,
      });
      const sibling = API.createElement({
        type: "rectangle",
        x: 400,
        y: 200,
        width: 100,
        height: 100,
        groupIds,
      });
      API.setElements([source, target, sibling]);
      act(() => {
        API.setAppState({
          openDialog: {
            name: "elementLinkSelector",
            sourceElementId: source.id,
          },
        });
      });
      return { target, sibling };
    };

    it("marks the hovered element", () => {
      const { target } = pickingFor();

      mouse.moveTo(250, 250);

      expect(h.state.hoveredElementIds).toEqual({ [target.id]: true });
    });

    it("marks the hovered element's whole group", () => {
      const { target, sibling } = pickingFor(["group"]);

      mouse.moveTo(250, 250);

      expect(h.state.hoveredElementIds).toEqual({
        [target.id]: true,
        [sibling.id]: true,
      });
    });

    it("clears it once nothing is hovered", () => {
      const { target } = pickingFor();
      mouse.moveTo(250, 250);
      expect(h.state.hoveredElementIds[target.id]).toBe(true);

      mouse.moveTo(600, 600);

      expect(h.state.hoveredElementIds).toEqual({});
    });
  });
});

describe("element links with links disabled", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tapping a link icon does not open the link", async () => {
    // interactive content restricted to the laser tool: the pointer handlers
    // still run, but `interaction.enabled.links` is off
    renderResult = await render(
      <Excalidraw
        activeTool={{ type: "laser" }}
        interaction={{ enabled: { tools: { laser: true } } }}
      />,
    );
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const rectangle = linkedRectangle();

    API.setElements([rectangle]);
    forceTouchScreen();

    expect(h.app.isLinksEnabled()).toBe(false);

    const { x, y } = linkIconCenter(200, 100);
    act(() => {
      mouse.clickAt(x, y);
    });

    expect(open).not.toHaveBeenCalled();
  });

  it("tapping a link icon opens the link once links are enabled", async () => {
    renderResult = await render(
      <Excalidraw
        activeTool={{ type: "laser" }}
        interaction={{ enabled: { links: true, tools: { laser: true } } }}
      />,
    );
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const rectangle = linkedRectangle();

    API.setElements([rectangle]);
    forceTouchScreen();

    expect(h.app.isLinksEnabled()).toBe(true);

    const { x, y } = linkIconCenter(200, 100);
    act(() => {
      mouse.clickAt(x, y);
    });

    expect(open).toHaveBeenCalled();
  });
});
