import React from "react";

import { queryByTestId, queryByText } from "@testing-library/react";

import { Excalidraw } from "../src/index";

import { UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  render,
  toggleMenu,
  unmountComponent,
} from "./test-utils";

const { h } = window;

unmountComponent();

const openCanvasContextMenu = () => {
  fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
    button: 2,
    clientX: 1,
    clientY: 1,
  });
  return UI.queryContextMenu()!;
};

/**
 * Host props upstream resolves on every render rather than once at mount:
 * `index.tsx` re-normalizes `UIOptions`, and `App.tsx` reads
 * `props.gridModeEnabled` (`isGridModeEnabled`) and `props.name` (`getName`)
 * live. Upstream has no test for changing them after mount — these are
 * caliburn's.
 */
describe("host props are re-read after mount", () => {
  describe("UIOptions", () => {
    it("hides a gated menu item when the host disables it after mount", async () => {
      const { container, rerender } = await render(<Excalidraw />);

      toggleMenu(container);
      expect(queryByTestId(container, "json-export-button")).not.toBeNull();

      act(() => {
        rerender(
          <Excalidraw UIOptions={{ canvasActions: { export: false } }} />,
        );
      });

      expect(queryByTestId(container, "json-export-button")).toBeNull();
    });

    it("restores a gated menu item when the host stops disabling it", async () => {
      const { container, rerender } = await render(
        <Excalidraw UIOptions={{ canvasActions: { export: false } }} />,
      );

      toggleMenu(container);
      expect(queryByTestId(container, "json-export-button")).toBeNull();

      act(() => {
        rerender(<Excalidraw />);
      });

      expect(queryByTestId(container, "json-export-button")).not.toBeNull();
    });

    it("re-normalizes over the defaults rather than over the previous value", async () => {
      const { rerender } = await render(
        <Excalidraw UIOptions={{ canvasActions: { clearCanvas: false } }} />,
      );
      expect(h.app.props.UIOptions.canvasActions.clearCanvas).toBe(false);

      act(() => {
        rerender(
          <Excalidraw UIOptions={{ canvasActions: { loadScene: false } }} />,
        );
      });

      expect(h.app.props.UIOptions.canvasActions.clearCanvas).toBe(true);
      expect(h.app.props.UIOptions.canvasActions.loadScene).toBe(false);
    });

    it("drops the keys the host no longer passes", async () => {
      const { rerender } = await render(
        <Excalidraw UIOptions={{ dockedSidebarBreakpoint: 500 }} />,
      );
      expect(h.app.props.UIOptions.dockedSidebarBreakpoint).toBe(500);

      act(() => {
        rerender(<Excalidraw UIOptions={{}} />);
      });

      expect(h.app.props.UIOptions.dockedSidebarBreakpoint).toBeUndefined();
    });
  });

  describe("gridModeEnabled", () => {
    it("drives the renderer without syncing `appState.gridModeEnabled`", async () => {
      const { rerender } = await render(<Excalidraw />);
      expect(h.state.gridModeEnabled).toBe(false);
      expect(h.app.getEffectiveGridSize()).toBe(null);

      act(() => {
        rerender(<Excalidraw gridModeEnabled={true} />);
      });

      expect(h.app.getEffectiveGridSize()).toBe(h.state.gridSize);
      // upstream's `componentDidUpdate` syncs only `zenModeEnabled` and
      // `theme` from the props — `state.gridModeEnabled` is seeded once, in
      // the constructor, and the prop is read live instead
      expect(h.state.gridModeEnabled).toBe(false);
    });

    it("hides the context-menu grid toggle once the host takes control", async () => {
      const { rerender } = await render(<Excalidraw />);
      expect(
        queryByText(openCanvasContextMenu(), "Toggle grid"),
      ).not.toBeNull();

      act(() => {
        rerender(<Excalidraw gridModeEnabled={false} />);
      });

      expect(queryByText(openCanvasContextMenu(), "Toggle grid")).toBeNull();
    });
  });

  describe("name", () => {
    it("is read live by `getName`", async () => {
      const { rerender } = await render(<Excalidraw name="initial" />);
      expect(h.app.getName()).toBe("initial");

      act(() => {
        rerender(<Excalidraw name="renamed" />);
      });

      // the scene name is seeded from the prop once, in the constructor, and
      // never re-synced (upstream's `componentDidUpdate`), so it wins...
      expect(h.state.name).toBe("initial");
      expect(h.app.getName()).toBe("initial");

      // ...but `getName` falls through to the live prop once the scene has
      // no name of its own
      act(() => {
        h.setState({ name: null });
      });

      expect(h.app.getName()).toBe("renamed");
    });
  });
});
