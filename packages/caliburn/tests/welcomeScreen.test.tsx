import React from "react";

import { KEYS } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, render } from "./test-utils";

import type { RenderResult } from "./test-utils";

let renderResult: RenderResult;

beforeEach(async () => {
  renderResult = await render(<Excalidraw />);
});

describe("WelcomeScreen", () => {
  it("renders the default center content on an empty scene", () => {
    const { container } = renderResult;

    const center = container.querySelector(".welcome-screen-center");
    expect(center).not.toBeNull();

    const logo = center!.querySelector(".welcome-screen-center__logo");
    expect(logo).not.toBeNull();
    expect(logo!.textContent?.trim()).toBe("Caliburn");
    expect(logo!.classList).toContain("excalifont");
    expect(logo!.classList).toContain("welcome-screen-decor");

    const heading = center!.querySelector(".welcome-screen-center__heading");
    expect(heading!.textContent?.trim()).toBe(
      t("welcomeScreen.defaults.center_heading"),
    );

    const menu = center!.querySelector(".welcome-screen-menu");
    expect(menu).not.toBeNull();

    const items = Array.from(
      menu!.querySelectorAll<HTMLElement>(".welcome-screen-menu-item"),
    );
    expect(
      items.map((item) =>
        item
          .querySelector(".welcome-screen-menu-item__text")
          ?.textContent?.trim(),
      ),
    ).toEqual([t("buttons.load"), t("helpDialog.title")]);
    // the load-scene item carries a shortcut, the help item is "?"
    expect(
      items[0].querySelector(".welcome-screen-menu-item__shortcut"),
    ).not.toBeNull();
    expect(
      items[1]
        .querySelector(".welcome-screen-menu-item__shortcut")
        ?.textContent?.trim(),
    ).toBe("?");
  });

  it("renders the menu, toolbar and help hints", () => {
    const { container } = renderResult;

    const menuHint = container.querySelector(
      ".welcome-screen-decor-hint--menu",
    );
    expect(menuHint?.textContent?.trim()).toBe(
      t("welcomeScreen.defaults.menuHint"),
    );

    const toolbarHint = container.querySelector(
      ".welcome-screen-decor-hint--toolbar",
    );
    expect(toolbarHint?.textContent?.trim()).toBe(
      t("welcomeScreen.defaults.toolbarHint"),
    );

    const helpHint = container.querySelector(
      ".welcome-screen-decor-hint--help",
    );
    expect(helpHint?.textContent?.trim()).toBe(
      t("welcomeScreen.defaults.helpHint"),
    );
  });

  it("disappears once an element exists", () => {
    const { container } = renderResult;
    expect(container.querySelector(".welcome-screen-center")).not.toBeNull();

    API.setElements([API.createElement({ type: "rectangle" })]);

    expect(container.querySelector(".welcome-screen-center")).toBeNull();
    expect(
      container.querySelector(".welcome-screen-decor-hint--menu"),
    ).toBeNull();
  });

  it("disappears once the user leaves the selection tool", () => {
    const { container } = renderResult;
    expect(container.querySelector(".welcome-screen-center")).not.toBeNull();

    act(() => {
      Keyboard.keyPress(KEYS.R);
    });

    expect(h.state.activeTool.type).toBe("rectangle");
    expect(container.querySelector(".welcome-screen-center")).toBeNull();
  });

  it("disappears in zen mode", () => {
    const { container } = renderResult;
    expect(container.querySelector(".welcome-screen-center")).not.toBeNull();

    API.setAppState({ zenModeEnabled: true });

    expect(container.querySelector(".welcome-screen-center")).toBeNull();
  });
});
