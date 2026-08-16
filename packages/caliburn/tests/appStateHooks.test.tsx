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
 * caliburn gate — both cases below are skipped: the surface under test is
 * React-only and has no caliburn counterpart.
 *
 * `useAppStateValue` / `useOnAppStateChange` (`hooks/useAppStateValue.ts`)
 * are React hooks read through `ExcalidrawAPIContext`, and both assertions
 * are React *render-count* assertions (`renderSpy` fires once per React
 * render of the consumer component). Caliburn has no hooks, no React
 * context, and no render-count notion to translate them into. The one piece
 * of the contract underneath that is framework-free — the
 * `ExcalidrawImperativeAPI.onStateChange` / `AppStateObserver` subscription
 * the hooks are built on — is itself unported: caliburn's
 * `CaliburnImperativeAPI` (`src/editor.component.ts`) carries no
 * `onStateChange`, and no `AppStateObserver` is instantiated anywhere in
 * `packages/caliburn/src`.
 *
 * The bodies are kept verbatim so the port is unskippable-in-place once that
 * API surface lands; as written they would exercise the vendored React
 * implementation only, not the Angular editor.
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
