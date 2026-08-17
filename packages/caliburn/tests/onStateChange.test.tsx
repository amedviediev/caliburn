import React from "react";
import { vi } from "vitest";

import { resolvablePromise } from "@excalidraw/common";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { act, render, unmountComponent } from "./test-utils";

import type { CaliburnImperativeAPI } from "../src/editor.component";

/**
 * Caliburn's wiring of the vendored `AppStateObserver`
 * (`packages/excalidraw/components/AppStateObserver.ts`), which upstream
 * exposes as `ExcalidrawImperativeAPI.onStateChange`. The observer's own
 * semantics are covered by upstream's tests; these cases pin the caliburn
 * side of it — that the editor notifies from its commit point with the right
 * prev/next pair, and that the API member behaves like upstream's after the
 * editor is destroyed.
 */
describe("api.onStateChange", () => {
  let excalidrawAPI: CaliburnImperativeAPI;

  beforeEach(async () => {
    const excalidrawAPIPromise = resolvablePromise<CaliburnImperativeAPI>();
    await render(
      <Excalidraw
        onExcalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
      />,
    );
    excalidrawAPI = await excalidrawAPIPromise;
  });

  it("should notify on a tool change", () => {
    const callback = vi.fn();
    excalidrawAPI.onStateChange("activeTool", callback);

    act(() => {
      UI.clickTool("rectangle");
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rectangle" }),
      expect.objectContaining({
        activeTool: expect.objectContaining({ type: "rectangle" }),
      }),
    );
  });

  it("should notify on a selection change", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);

    const callback = vi.fn();
    excalidrawAPI.onStateChange("selectedElementIds", callback);

    act(() => {
      API.setSelectedElements([rectangle]);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      { [rectangle.id]: true },
      expect.objectContaining({
        selectedElementIds: { [rectangle.id]: true },
      }),
    );
  });

  it("should notify on a zoom change through a selector", () => {
    const callback = vi.fn();
    excalidrawAPI.onStateChange((state) => state.zoom.value, callback);

    act(() => {
      API.setAppState({ zoom: { value: 2 as typeof h.state.zoom.value } });
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ zoom: { value: 2 } }),
    );
  });

  it("should notify on the listed props only, against the previous commit", () => {
    const callback = vi.fn();
    excalidrawAPI.onStateChange(["viewModeEnabled"], callback);

    act(() => {
      API.setAppState({ currentItemStrokeColor: "#c92a2a" });
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      API.setAppState({ viewModeEnabled: true });
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // a write that lands on the same value is not a transition
    act(() => {
      API.setAppState({ viewModeEnabled: true });
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should notify once the commit lands, not on each write within it", () => {
    const callback = vi.fn();
    excalidrawAPI.onStateChange("viewModeEnabled", callback);

    h.app.batchCommits(() => {
      h.app.setState({ viewModeEnabled: true });
      h.app.setState({ zenModeEnabled: true });
      expect(callback).not.toHaveBeenCalled();
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ viewModeEnabled: true, zenModeEnabled: true }),
    );
  });

  it("should settle every listener on the live value when one of them writes", () => {
    const seen: string[] = [];
    const seenOnce: string[] = [];

    excalidrawAPI.onStateChange("activeTool", (activeTool) => {
      if (activeTool.type === "rectangle") {
        excalidrawAPI.setActiveTool({ type: "ellipse" });
      }
    });
    excalidrawAPI.onStateChange("activeTool", (activeTool) => {
      seen.push(activeTool.type);
    });
    excalidrawAPI.onStateChange(
      "activeTool",
      (activeTool) => {
        seenOnce.push(activeTool.type);
      },
      { once: true },
    );

    act(() => {
      UI.clickTool("rectangle");
    });

    expect(h.state.activeTool.type).toBe("ellipse");
    // upstream's writing listener only schedules a render, so the pass it
    // interrupts finishes on the state it started with and the write is
    // delivered by a later, complete pass — never as an older value arriving
    // after a newer one
    expect(seen).toEqual(["rectangle", "ellipse"]);
    expect(seenOnce).toEqual(["rectangle"]);
  });

  it("should honor `once`", () => {
    const callback = vi.fn();
    excalidrawAPI.onStateChange("currentItemStrokeColor", callback, {
      once: true,
    });

    act(() => {
      API.setAppState({ currentItemStrokeColor: "#c92a2a" });
    });
    act(() => {
      API.setAppState({ currentItemStrokeColor: "#1971c2" });
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("#c92a2a", expect.anything());
  });

  it("should stop delivering once unsubscribed", () => {
    const callback = vi.fn();
    const unsubscribe = excalidrawAPI.onStateChange(
      "currentItemStrokeColor",
      callback,
    );

    act(() => {
      API.setAppState({ currentItemStrokeColor: "#c92a2a" });
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();

    act(() => {
      API.setAppState({ currentItemStrokeColor: "#1971c2" });
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should resolve the promise form with the next value", async () => {
    const zenMode = excalidrawAPI.onStateChange("zenModeEnabled");

    act(() => {
      API.setAppState({ zenModeEnabled: true });
    });

    await expect(zenMode).resolves.toBe(true);
  });

  it("should resolve the predicate form once it matches", async () => {
    const zoomedIn = excalidrawAPI.onStateChange({
      predicate: (state) => state.zoom.value > 1,
    });

    act(() => {
      API.setAppState({ zoom: { value: 2 as typeof h.state.zoom.value } });
    });

    await expect(zoomedIn).resolves.toEqual(
      expect.objectContaining({ zoom: { value: 2 } }),
    );
  });

  it("should throw once the editor is destroyed", () => {
    const app = h.app;
    unmountComponent();

    const api = app.getApi();
    expect(api.isDestroyed).toBe(true);
    expect(() => api.onStateChange("viewModeEnabled", vi.fn())).toThrow(
      /no longer usable/,
    );
  });
});
