import React from "react";

import type {
  ExcalidrawBindableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const container = () => document.querySelector<HTMLElement>(".excalidraw")!;

const toolIcon = (tool: string) =>
  document.querySelector<HTMLButtonElement>(`[data-testid="toolbar-${tool}"]`)!;

describe("setActiveTool's focus & binding steps", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  describe("focus", () => {
    it("hands focus back to the container when a tool icon holds it", () => {
      const icon = toolIcon("rectangle");
      act(() => icon.focus());
      expect(document.activeElement).toBe(icon);
      // the predicate `isToolIcon` reads
      expect(icon.className).toContain("ToolIcon");

      act(() => h.app.setActiveTool({ type: "rectangle" }));

      expect(document.activeElement).toBe(container());
    });

    it("leaves focus alone when it sits on anything else", () => {
      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      act(() => textarea.focus());
      expect(document.activeElement).toBe(textarea);

      act(() => h.app.setActiveTool({ type: "rectangle" }));

      expect(document.activeElement).toBe(textarea);
      textarea.remove();
    });
  });

  describe("suggested binding", () => {
    const suggestBinding = () => {
      const target = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([target]);
      act(() =>
        h.app.setState({
          suggestedBinding: {
            element: target as NonDeleted<ExcalidrawBindableElement>,
          },
        }),
      );
      expect(h.state.suggestedBinding).not.toBe(null);
    };

    it("drops it when the next tool is not a linear one", () => {
      suggestBinding();

      act(() => h.app.setActiveTool({ type: "rectangle" }));

      expect(h.state.suggestedBinding).toBe(null);
    });

    it("keeps it when the next tool is a linear one", () => {
      suggestBinding();

      act(() => h.app.setActiveTool({ type: "arrow" }));

      expect(h.state.suggestedBinding).not.toBe(null);

      act(() => h.app.setActiveTool({ type: "line" }));

      expect(h.state.suggestedBinding).not.toBe(null);
    });
  });
});
