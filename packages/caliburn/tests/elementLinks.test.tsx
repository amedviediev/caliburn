import React from "react";

import { KEYS } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import {
  GlobalTestState,
  act,
  fireEvent,
  render,
  unmountComponent,
} from "./test-utils";

import type { RenderResult } from "./test-utils";

const { h } = window;

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
});
