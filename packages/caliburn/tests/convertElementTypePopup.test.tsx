import React from "react";

import { KEYS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render } from "./test-utils";

const getPopup = () =>
  document.querySelector<HTMLElement>(".ConvertElementTypePopup");

const getPopupButtons = () =>
  [...(getPopup()?.querySelectorAll("button") ?? [])].map((button) => ({
    testId: button.getAttribute("data-testid"),
    checked: button.getAttribute("aria-pressed"),
  }));

const selectRectangle = () => {
  const rectangle = API.createElement({ type: "rectangle" });
  API.setElements([rectangle]);
  API.setSelectedElements([rectangle]);
  act(() => {
    h.app.focusContainer();
  });
  return rectangle;
};

describe("convert element type popup", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("opens on Tab with a convertible selection, without converting yet", () => {
    selectRectangle();
    expect(getPopup()).toBeNull();

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });

    expect(getPopup()).not.toBeNull();
    expect(h.elements[0].type).toBe("rectangle");
    expect(getPopupButtons()).toEqual([
      { testId: "toolbar-rectangle", checked: "true" },
      { testId: "toolbar-diamond", checked: "false" },
      { testId: "toolbar-ellipse", checked: "false" },
    ]);
  });

  it("cycles the type forward on Tab and back on Shift+Tab", () => {
    selectRectangle();

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    expect(h.elements[0].type).toBe("diamond");

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    expect(h.elements[0].type).toBe("ellipse");

    act(() => {
      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress(KEYS.TAB);
      });
    });
    expect(h.elements[0].type).toBe("diamond");
    expect(getPopup()).not.toBeNull();
  });

  it("keeps cycling once the popup itself holds focus", () => {
    selectRectangle();

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    act(() => {
      getPopup()!.focus();
    });
    expect(document.activeElement).toBe(getPopup());

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    expect(h.elements[0].type).toBe("diamond");
  });

  it("converts when a type is clicked, and focuses the popup", () => {
    selectRectangle();

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    act(() => {
      fireEvent.click(
        getPopup()!.querySelector('[data-testid="toolbar-ellipse"]')!,
      );
    });

    expect(h.elements[0].type).toBe("ellipse");
    expect(getPopup()).not.toBeNull();
    expect(document.activeElement).toBe(getPopup());
  });

  it("closes on Escape", () => {
    selectRectangle();

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    expect(getPopup()).not.toBeNull();

    act(() => {
      Keyboard.keyPress(KEYS.ESCAPE);
    });
    expect(getPopup()).toBeNull();
  });

  it("closes when the selection is emptied", () => {
    selectRectangle();

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    expect(getPopup()).not.toBeNull();

    act(() => {
      API.setSelectedElements([]);
    });
    expect(getPopup()).toBeNull();
  });

  it("does not open while the editor container is not focused", () => {
    selectRectangle();
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });

    expect(getPopup()).toBeNull();
  });

  it("restores a bound text's font size when its container round-trips back", () => {
    // long enough that wrapping alone cannot fit it into an ellipse
    const [container, label] = API.createTextContainer({
      label: { text: "abcdefghijklmnopqrstuvwxyz0123" },
    });
    API.setElements([container, label]);
    API.setSelectedElements([container]);
    act(() => {
      h.app.focusContainer();
    });

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    act(() => {
      fireEvent.click(
        getPopup()!.querySelector('[data-testid="toolbar-ellipse"]')!,
      );
    });
    expect(h.elements[0].type).toBe("ellipse");
    const asEllipse = (h.elements[1] as ExcalidrawTextElement).fontSize;

    act(() => {
      fireEvent.click(
        getPopup()!.querySelector('[data-testid="toolbar-rectangle"]')!,
      );
    });
    expect(h.elements[0].type).toBe("rectangle");
    expect((h.elements[1] as ExcalidrawTextElement).fontSize).toBeGreaterThan(
      asEllipse,
    );
  });

  it("restores the original points when a linear element round-trips back", () => {
    const points: LocalPoint[] = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(100, 100),
    ];
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points,
    });
    API.setElements([line]);
    API.setSelectedElements([line]);
    act(() => {
      h.app.focusContainer();
    });

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    expect(getPopupButtons().map((button) => button.testId)).toEqual([
      "toolbar-line",
      "toolbar-sharpArrow",
      "toolbar-curvedArrow",
      "toolbar-elbowArrow",
    ]);

    // line -> sharpArrow -> curvedArrow -> elbowArrow
    for (let i = 0; i < 3; i++) {
      act(() => {
        Keyboard.keyPress(KEYS.TAB);
      });
    }
    expect(h.elements[0].type).toBe("arrow");
    expect((h.elements[0] as ExcalidrawLinearElement).points).not.toEqual(
      points,
    );

    // ...and back round to line, which the cache restores verbatim
    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });
    expect(h.elements[0].type).toBe("line");
    expect((h.elements[0] as ExcalidrawLinearElement).points).toEqual(points);
  });

  it("does not open without a convertible selection", () => {
    API.setElements([]);
    act(() => {
      h.app.focusContainer();
    });

    act(() => {
      Keyboard.keyPress(KEYS.TAB);
    });

    expect(getPopup()).toBeNull();
  });
});
