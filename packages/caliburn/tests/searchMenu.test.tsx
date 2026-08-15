import React from "react";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  DEFAULT_SIDEBAR,
  KEYS,
} from "@excalidraw/common";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import {
  GlobalTestState,
  act,
  fireEvent,
  getByTestId,
  render,
  waitFor,
} from "./test-utils";

import type { RenderResult } from "./test-utils";

const { h } = window;

let renderResult: RenderResult;

const openSearch = () => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.F);
  });
  return renderResult.container.querySelector<HTMLInputElement>(
    `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
  )!;
};

const search = async (query: string, expectedMatches: number) => {
  const input = openSearch();
  updateTextEditor(input, query);
  await waitFor(() => {
    expect(h.app.state.searchMatches?.matches.length).toBe(expectedMatches);
  });
  return input;
};

beforeEach(async () => {
  renderResult = await render(<Excalidraw handleKeyboardGlobally />);
  API.setAppState({ openSidebar: null });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("SearchMenu", () => {
  it("opens from the main menu item", () => {
    act(() => {
      fireEvent.click(getByTestId(renderResult.container, "main-menu-trigger"));
    });
    act(() => {
      fireEvent.click(
        getByTestId(renderResult.container, "search-menu-button"),
      );
    });

    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);
    expect(
      renderResult.container.querySelector(".layer-ui__search"),
    ).not.toBeNull();
  });

  it("closes on escape and clears the matches", async () => {
    API.setElements([API.createElement({ type: "text", text: "test one" })]);

    const input = await search("test", 1);

    Keyboard.keyPress(KEYS.ESCAPE, input);

    expect(h.app.state.openSidebar).toBeNull();
    expect(h.app.state.searchMatches).toBeNull();
    expect(
      renderResult.container.querySelector(".layer-ui__search"),
    ).toBeNull();
  });

  it("renders the frame and text result sections", async () => {
    API.setElements([
      API.createElement({ type: "text", text: "a test text" }),
      API.createElement({ type: "frame" }),
    ]);
    API.updateElement(h.elements[1] as ExcalidrawFrameLikeElement, {
      name: "test frame",
    });

    await search("test", 2);

    const { container } = renderResult;
    const titles = Array.from(
      container.querySelectorAll(".layer-ui__search-result-title"),
    ).map((title) => title.textContent);
    expect(titles).toEqual(["Frames", "Texts"]);

    const items = container.querySelectorAll(".layer-ui__result-item");
    expect(items.length).toBe(2);
    // frame matches come first, and the first visible match is focused
    expect(items[0].classList).toContain("active");
    expect(items[0].querySelector("b")?.textContent).toBe("test");
    // upstream's `getMatchPreview` re-adds the separator in front of the
    // trailing words, so a match at index 0 previews with a doubled space
    expect(items[0].querySelector(".preview-text")?.textContent).toBe(
      "test  frame",
    );
    expect(container.querySelector(".layer-ui__divider")).not.toBeNull();
    expect(
      container.querySelector(".layer-ui__search-count")?.textContent,
    ).toContain("1 / 2 results");
  });

  it("focuses a match when its result item is clicked", async () => {
    API.setElements([
      API.createElement({ type: "text", text: "test one" }),
      API.createElement({ type: "text", text: "test two", y: 100 }),
    ]);

    await search("test", 2);

    const items = renderResult.container.querySelectorAll<HTMLElement>(
      ".layer-ui__result-item",
    );

    act(() => {
      fireEvent.click(items[1]);
    });

    expect(h.app.state.searchMatches?.matches[1].focus).toBe(true);
    expect(h.app.state.searchMatches?.focusedId).toBe(h.elements[1].id);
    expect(items[1].classList).toContain("active");
  });

  it("cycles matches with the result nav buttons", async () => {
    API.setElements([
      API.createElement({ type: "text", text: "test one" }),
      API.createElement({ type: "text", text: "test two", y: 100 }),
    ]);

    await search("test", 2);

    const [next, previous] =
      renderResult.container.querySelectorAll<HTMLButtonElement>(
        ".result-nav-btn",
      );

    act(() => {
      fireEvent.click(next);
    });
    expect(h.app.state.searchMatches?.matches[1].focus).toBe(true);

    act(() => {
      fireEvent.click(previous);
    });
    expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
  });

  it("shows the no-match message for a query without results", async () => {
    API.setElements([API.createElement({ type: "text", text: "test one" })]);

    const input = openSearch();
    updateTextEditor(input, "nothing");

    await waitFor(() => {
      expect(
        renderResult.container.querySelector(".layer-ui__search-count")
          ?.textContent,
      ).toContain("No match");
    });
    expect(h.app.state.searchMatches).toBeNull();
  });

  it("drops the focus from the matches on a canvas pointerdown", async () => {
    API.setElements([API.createElement({ type: "text", text: "test one" })]);

    await search("test", 1);
    expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);

    act(() => {
      fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
        clientX: 400,
        clientY: 400,
      });
    });

    expect(h.app.state.searchMatches?.matches[0].focus).toBe(false);
    expect(h.app.state.searchMatches?.focusedId).toBeNull();
  });
});
