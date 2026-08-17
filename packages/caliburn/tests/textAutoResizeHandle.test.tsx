import React from "react";

import { CURSOR_TYPE } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { getTextAutoResizeHandle } from "@excalidraw/excalidraw/textAutoResizeHandle";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  GlobalTestState,
  render,
  withExcalidrawDimensions,
} from "./test-utils";

/**
 * Caliburn-authored: upstream covers `actionTextAutoResize` itself (ported
 * verbatim into `textWysiwyg.test.tsx`'s "autoResize handle" block) but has no
 * test for the handle that runs it — `App.isHittingTextAutoResizeHandle` and
 * `App.handleTextAutoResizeHandlePointerDown`, and their two call sites in the
 * hover pass and on pointer down.
 */

const mouse = new Pointer("mouse");

const cursor = () => GlobalTestState.interactiveCanvas.style.cursor;

/**
 * Seeds the scene through `updateScene` rather than `API.setElements`, so the
 * store's snapshot keeps up with it — otherwise the first captured increment
 * reads as "the text appeared", and undoing it deletes the element instead of
 * restoring its box.
 */
const setElements = (elements: readonly ExcalidrawElement[]) =>
  API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });

/**
 * a fixed-width text wrapped onto two lines. `originalText`/`autoResize` are
 * set after the fact — `API.createElement` accepts neither, and would
 * otherwise leave an autogrowing element whose `originalText` still holds the
 * line break.
 */
const wrappedText = (
  overrides: Partial<ExcalidrawTextElement> = {},
): NonDeleted<ExcalidrawTextElement> =>
  ({
    ...API.createElement({
      type: "text",
      id: "text",
      x: 100,
      y: 100,
      width: 300,
      height: 50,
      text: "this is it my friends\nald aksdl askdlasdk",
    }),
    originalText: "this is it my friends ald aksdl askdlasdk",
    autoResize: false,
    ...overrides,
  } as NonDeleted<ExcalidrawTextElement>);

/** the scene coords of the handle's centre, off the vendored geometry */
const handleCenter = (element: ExcalidrawTextElement): [number, number] => {
  const handle = getTextAutoResizeHandle(
    element,
    h.state.zoom.value,
    h.app.editorInterface.formFactor,
  );
  if (!handle) {
    throw new Error("no auto-resize handle");
  }
  return [handle.center[0], handle.center[1]];
};

const text = () => h.elements[0] as NonDeleted<ExcalidrawTextElement>;

describe("text auto-resize handle", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
  });

  describe("hover", () => {
    it("sets the pointer cursor over the handle of a selected wrapped text", () => {
      const element = wrappedText();
      setElements([element]);
      API.setSelectedElements([element]);

      mouse.moveTo(...handleCenter(element));

      expect(cursor()).toBe(CURSOR_TYPE.POINTER);
    });

    it("leaves the cursor alone just outside the handle's hitbox", () => {
      const element = wrappedText();
      setElements([element]);
      API.setSelectedElements([element]);
      const [x, y] = handleCenter(element);

      mouse.moveTo(x + 20, y);

      expect(cursor()).not.toBe(CURSOR_TYPE.POINTER);
    });

    it("ignores a text that already auto-resizes", () => {
      const element = wrappedText();
      const [x, y] = handleCenter(element);
      setElements([wrappedText({ autoResize: true })]);
      API.setSelectedElements([text()]);

      mouse.moveTo(x, y);

      expect(cursor()).not.toBe(CURSOR_TYPE.POINTER);
    });

    it("ignores the handle when the text is not the only selected element", () => {
      const element = wrappedText();
      const rectangle = API.createElement({
        type: "rectangle",
        x: 600,
        y: 600,
        width: 50,
        height: 50,
      });
      setElements([element, rectangle]);
      API.setSelectedElements([element, rectangle]);

      mouse.moveTo(...handleCenter(element));

      expect(cursor()).not.toBe(CURSOR_TYPE.POINTER);
    });

    // upstream's pointer-move gate (App.tsx:7908-7920) returns before the
    // auto-resize hit test for every tool outside its list
    it("ignores the handle while a drawing tool is active", () => {
      const element = wrappedText();
      setElements([element]);
      UI.clickTool("rectangle");
      API.setSelectedElements([element]);

      mouse.moveTo(...handleCenter(element));

      expect(cursor()).not.toBe(CURSOR_TYPE.POINTER);
    });
  });

  describe("click", () => {
    it("unwraps the text, in one undo step", () => {
      const element = wrappedText();
      setElements([element]);
      API.setSelectedElements([element]);
      const stackSize = API.getUndoStack().length;

      mouse.clickAt(...handleCenter(element));

      expect(text().autoResize).toBe(true);
      expect(text().text).toBe(element.originalText);
      // the box really did change size, so the assertion isn't vacuous
      expect(text().width).not.toBeCloseTo(300, 0);
      expect(API.getUndoStack().length).toBe(stackSize + 1);

      Keyboard.undo();

      expect(text().autoResize).toBe(false);
      expect(text().width).toBeCloseTo(300, 0);
    });

    it("consumes the pointer, so no box selection starts", () => {
      const element = wrappedText();
      setElements([element]);
      API.setSelectedElements([element]);

      mouse.downAt(...handleCenter(element));

      expect(h.state.selectionElement).toBe(null);
      expect(h.state.selectedElementIds).toEqual({ [element.id]: true });

      mouse.up();
    });

    it("leaves a click next to the handle to the rest of the pointer flow", () => {
      const element = wrappedText();
      setElements([element]);
      API.setSelectedElements([element]);
      const [x, y] = handleCenter(element);

      mouse.clickAt(x + 20, y);

      expect(text().autoResize).toBe(false);
      expect(h.state.selectedElementIds).toEqual({});
    });

    it("ignores a text that already auto-resizes", () => {
      const element = wrappedText();
      const [x, y] = handleCenter(element);
      setElements([wrappedText({ autoResize: true })]);
      API.setSelectedElements([text()]);

      mouse.clickAt(x, y);

      // the click lands outside the box, so the selection clears — what must
      // not happen is the box being re-measured
      expect(text().width).toBeCloseTo(300, 0);
      expect(text().text).toBe(element.text);
    });
  });

  // the vendored geometry draws no handle off the desktop form factor, so
  // neither half of this may fire there
  it("has no handle on a phone", async () => {
    const element = wrappedText();
    setElements([element]);
    API.setSelectedElements([element]);
    const [x, y] = handleCenter(element);

    await withExcalidrawDimensions({ width: 400, height: 800 }, () => {
      expect(h.app.editorInterface.formFactor).toBe("phone");
      expect(getTextAutoResizeHandle(text(), h.state.zoom.value, "phone")).toBe(
        null,
      );

      mouse.moveTo(x, y);
      expect(cursor()).not.toBe(CURSOR_TYPE.POINTER);

      mouse.clickAt(x, y);
      expect(text().autoResize).toBe(false);
    });
  });
});
