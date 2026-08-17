import { act, cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { ExcalidrawAPIContext } from "@excalidraw/excalidraw/components/App";
import { AppStateObserver } from "@excalidraw/excalidraw/components/AppStateObserver";
import {
  useAppStateValue,
  useOnAppStateChange,
} from "@excalidraw/excalidraw/hooks/useAppStateValue";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

/**
 * caliburn gate — both cases below stay skipped, and what stays React-only is
 * now only their *measurement*: `renderSpy`, which fires once per React render
 * of a consumer component mounted under `ExcalidrawAPIContext.Provider`. There
 * is no render to count in caliburn (a signal read is not a render), and both
 * bodies mount `useAppStateValue` / `useOnAppStateChange`
 * (`hooks/useAppStateValue.ts`) themselves, so as written they exercise the
 * vendored React hooks, not the Angular editor — which the vendored copy of
 * this same file (`packages/excalidraw/tests/appStateHooks.test.tsx`) already
 * does in the `editor` project of this very workspace run.
 *
 * What the two cases assert *underneath* the render counts is framework-free,
 * and is now ported as caliburn-authored suites against the real editor:
 *  - "rerenders when the selected value changes" → `appStateValue.test.ts`,
 *    where the value tracks the selected prop and a downstream `computed`
 *    re-evaluates on that change and on nothing else (the counter that stands
 *    in for the render count).
 *  - "notifies without rerendering" → `onStateChange.test.tsx`, where
 *    `api.onStateChange` delivers `(value, appState)` for each change,
 *    honours `once`/unsubscribe/the promise form, and never touches a view.
 * `useOnAppStateChange`'s extra hook-level courtesy — invoking the callback
 * once on mount, before any change — has no counterpart on the API itself;
 * `appStateValue()` covers that need by seeding its signal eagerly.
 */

const createAppState = (): AppState => ({
  ...getDefaultAppState(),
  width: 0,
  height: 0,
  offsetLeft: 0,
  offsetTop: 0,
});

const createMockAPI = (initialState: AppState) => {
  let state = initialState;
  const observer = new AppStateObserver(() => state);

  return {
    api: {
      isDestroyed: false,
      getAppState: () => state,
      onStateChange: observer.onStateChange,
    } as Pick<
      ExcalidrawImperativeAPI,
      "isDestroyed" | "getAppState" | "onStateChange"
    > as ExcalidrawImperativeAPI,
    updateAppState: (partial: Partial<AppState>) => {
      const prevState = state;
      state = { ...state, ...partial };
      observer.flush(prevState);
    },
  };
};

describe("app state hooks", () => {
  afterEach(() => {
    cleanup();
  });

  it.skip("useAppStateValue rerenders when the selected value changes", () => {
    const renderSpy = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());

    const ValueConsumer = () => {
      const value = useAppStateValue("viewModeEnabled");
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={api}>
        <ValueConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("false");
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });

    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it.skip("useOnAppStateChange notifies without rerendering", () => {
    const renderSpy = vi.fn();
    const callback = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());

    const ChangeConsumer = () => {
      const value = useOnAppStateChange("viewModeEnabled", callback);
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={api}>
        <ChangeConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("undefined");
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ viewModeEnabled: false }),
    );

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ viewModeEnabled: true }),
    );
  });
});
