import { vi } from "vitest";

import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import type { AppState } from "@excalidraw/excalidraw/types";

import { appStateValue } from "../src/app-state-value";

import { API } from "./helpers/api";
import { CaliburnAppStateValueHostComponent } from "./helpers/app-state-value-hosts.component";
import { act, renderHost, unmountComponent } from "./test-utils";

import type { CaliburnAppStateValueConsumerComponent } from "./helpers/app-state-value-hosts.component";
import type { ComponentRef } from "@angular/core";

/**
 * `appStateValue()` — caliburn's counterpart of upstream's
 * `useAppStateValue` hook. The value updates on the selected slice only, and
 * a downstream `computed` re-evaluates exactly then, which is what the hook's
 * render-count assertion means on the Angular side.
 */
describe("appStateValue()", () => {
  let componentRef: ComponentRef<CaliburnAppStateValueHostComponent>;
  let consumer: CaliburnAppStateValueConsumerComponent;

  beforeEach(async () => {
    ({ componentRef } = await renderHost(CaliburnAppStateValueHostComponent));
    consumer = componentRef.instance.consumer()!;
  });

  it("should track the selected prop", () => {
    expect(consumer.viewMode()).toBe(false);

    act(() => {
      API.setAppState({ viewModeEnabled: true });
    });

    expect(consumer.viewMode()).toBe(true);
  });

  it("should re-evaluate readers only when the selected prop changes", () => {
    expect(consumer.derivedViewMode()).toBe(false);
    expect(consumer.evaluations).toBe(1);
    consumer.derivedModes();
    expect(consumer.modeEvaluations).toBe(1);

    act(() => {
      API.setAppState({ currentItemStrokeColor: "#c92a2a" });
    });

    expect(consumer.derivedViewMode()).toBe(false);
    expect(consumer.evaluations).toBe(1);
    consumer.derivedModes();
    expect(consumer.modeEvaluations).toBe(1);

    act(() => {
      API.setAppState({ viewModeEnabled: true });
    });

    expect(consumer.derivedViewMode()).toBe(true);
    expect(consumer.evaluations).toBe(2);

    act(() => {
      API.setAppState({ zenModeEnabled: true });
    });

    expect(consumer.derivedModes().zenModeEnabled).toBe(true);
    expect(consumer.modeEvaluations).toBe(2);
  });

  it("should yield the whole appState for the array form", () => {
    expect(consumer.modes().zenModeEnabled).toBe(false);

    const beforeUnrelated = consumer.modes();
    act(() => {
      API.setAppState({ currentItemStrokeColor: "#c92a2a" });
    });
    expect(consumer.modes()).toBe(beforeUnrelated);

    act(() => {
      API.setAppState({ zenModeEnabled: true });
    });
    expect(consumer.modes().zenModeEnabled).toBe(true);
    expect(consumer.modes().currentItemStrokeColor).toBe("#c92a2a");
  });

  it("should track a selector's return value", () => {
    expect(consumer.zoom()).toBe(1);

    act(() => {
      API.setAppState({ zoom: { value: 2 as AppState["zoom"]["value"] } });
    });

    expect(consumer.zoom()).toBe(2);
  });

  it("should stop tracking once its consumer is destroyed", () => {
    componentRef.setInput("showConsumer", false);
    act(() => {});

    expect(componentRef.instance.consumer()).toBeUndefined();

    act(() => {
      API.setAppState({ viewModeEnabled: true });
    });

    expect(consumer.viewMode()).toBe(false);
  });
});

describe("appStateValue() outside an editor", () => {
  beforeEach(() => {
    unmountComponent();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it("should warn and fall back to the default appState", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const [color, state] = TestBed.runInInjectionContext(() => [
      appStateValue("currentItemStrokeColor"),
      appStateValue(["viewModeEnabled"]),
    ]);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("appStateValue: excalidrawAPI not defined yet"),
    );
    expect(color()).toBe(getDefaultAppState().currentItemStrokeColor);
    expect(state()).toEqual(
      expect.objectContaining({ width: 0, height: 0, viewModeEnabled: false }),
    );

    warn.mockRestore();
  });

  it("should stay silent and undefined when not internal", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const color = TestBed.runInInjectionContext(() =>
      appStateValue("currentItemStrokeColor", false),
    );

    expect(warn).not.toHaveBeenCalled();
    expect(color()).toBeUndefined();

    warn.mockRestore();
  });
});
