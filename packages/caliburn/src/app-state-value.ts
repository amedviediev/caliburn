import { DestroyRef, forwardRef, inject, signal } from "@angular/core";

import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import type { AppState } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "./editor.component";

import type {
  CaliburnEditorComponent,
  CaliburnImperativeAPI,
} from "./editor.component";
import type { Signal } from "@angular/core";

type AppStateSelector =
  | keyof AppState
  | (keyof AppState)[]
  | ((appState: AppState) => unknown);

const getSelectedValue = (appState: AppState, selector: AppStateSelector) => {
  if (typeof selector === "function") {
    return selector(appState);
  }
  if (Array.isArray(selector)) {
    return appState;
  }
  return appState[selector];
};

const getLatestValue = (
  api: CaliburnImperativeAPI | null,
  selector: AppStateSelector,
  _internal: boolean,
) => {
  if (api?.isDestroyed) {
    return;
  }

  let appState = api?.getAppState();
  if (!appState) {
    if (!_internal) {
      return undefined;
    }

    console.warn(
      "appStateValue: excalidrawAPI not defined yet for internal component while it should always be defined. Are you sure you're rendering inside of <caliburn-editor/> component tree?",
    );
    // fall back in case there's a bug so we don't break the app
    // (internal components using this internal appStateValue expect
    //  non-undefined values on init)
    appState = Object.assign(
      { width: 0, height: 0, offsetLeft: 0, offsetTop: 0 },
      getDefaultAppState(),
    );
  }

  return getSelectedValue(appState, selector);
};

/**
 * Angular port of upstream `hooks/useAppStateValue.ts`: a signal carrying one
 * slice of appState, written only when that slice changes — the counterpart
 * of the hook re-rendering its component only when the selected prop moves,
 * and of `changeGeneration`, which moves on every commit, for the readers
 * that want just one prop.
 *
 * Returns the narrowed value depending on the selector form:
 *  - `keyof AppState` → `AppState[K]`
 *  - `(keyof AppState)[]` → whole `AppState`
 *  - selector function → selector's return type `T`
 *
 * Must be called from an injection context (a component field initializer or
 * constructor) — that is what supplies the editor and the teardown hook, the
 * way React's hook rules supply the context and the effect cleanup. Upstream's
 * "excalidrawAPI not ready yet" phase has no counterpart: the editor resolves
 * synchronously through DI or not at all, so `_internal` consumers rendered
 * outside an editor warn and fall back to the default appState right away,
 * exactly as the hook does when its context is empty.
 */
export function appStateValue<K extends keyof AppState>(
  prop: K,
  _internal?: boolean,
): Signal<AppState[K]>;
export function appStateValue(
  props: (keyof AppState)[],
  _internal?: boolean,
): Signal<AppState>;
export function appStateValue<T>(
  selector: (appState: AppState) => T,
  _internal?: boolean,
): Signal<T>;
export function appStateValue(
  selector: AppStateSelector,
  _internal: boolean = true,
): Signal<unknown> {
  const editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
    { optional: true },
  );

  const api = editor?.getApi() ?? null;
  const value = signal(getLatestValue(api, selector, _internal));

  if (api && !api.isDestroyed) {
    const unsubscribe = api.onStateChange(selector, (latestValue: unknown) => {
      value.set(latestValue);
    });
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  return value.asReadonly();
}
