import React from "react";

import { resolvablePromise } from "@excalidraw/common";
import { StoreDelta, StoreIncrement } from "@excalidraw/element";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { UI } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

import type { CaliburnImperativeAPI } from "../src/editor.component";

unmountComponent();

describe("excalidrawAPI.applyDeltas", () => {
  let api: CaliburnImperativeAPI;
  let lastDelta: StoreDelta | null;

  beforeEach(async () => {
    lastDelta = null;
    const apiPromise = resolvablePromise<CaliburnImperativeAPI>();
    await render(
      <Excalidraw onExcalidrawAPI={(a) => apiPromise.resolve(a as any)} />,
    );
    api = await apiPromise;
    api.onIncrement((increment) => {
      if (StoreIncrement.isDurable(increment as StoreIncrement)) {
        lastDelta = (increment as never as { delta: StoreDelta }).delta;
      }
    });
  });

  it("applies a captured delta's inverse without touching the scene", () => {
    UI.createElement("rectangle", { width: 100, height: 100 });

    const created = h.elements[0];
    expect(created.isDeleted).toBe(false);
    expect(lastDelta).not.toBe(null);

    const [nextElements, , containsVisibleChange] = api.applyDeltas([
      StoreDelta.inverse(lastDelta!),
    ]);

    // the returned copy has the creation undone …
    expect(nextElements.get(created.id)?.isDeleted).toBe(true);
    expect(containsVisibleChange).toBe(true);
    // … while the scene itself is untouched
    expect(h.elements[0].isDeleted).toBe(false);
    expect(nextElements).not.toBe(h.app.scene.getElementsMapIncludingDeleted());
  });

  it("squashes the supplied deltas before applying them", () => {
    UI.createElement("rectangle", { width: 100, height: 100 });
    const first = lastDelta!;

    UI.createElement("ellipse", { x: 300, y: 300, width: 50, height: 50 });
    const second = lastDelta!;

    expect(first).not.toBe(second);

    const [nextElements] = api.applyDeltas([
      StoreDelta.inverse(first),
      StoreDelta.inverse(second),
    ]);

    for (const element of h.elements) {
      expect(nextElements.get(element.id)?.isDeleted).toBe(true);
    }
  });
});
