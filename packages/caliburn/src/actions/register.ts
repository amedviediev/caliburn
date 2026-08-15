import type { Action } from "@excalidraw/excalidraw/actions/types";

export let actions: readonly Action[] = [];

/**
 * Mirrors the upstream action registry so copied action modules keep their
 * `register(...)` calls unchanged.
 */
export const register = <
  TData extends any,
  T extends Action<TData> = Action<TData>,
>(
  action: T,
) => {
  actions = actions.concat(action);
  return action as T & {
    keyTest?: unknown extends T["keyTest"] ? never : T["keyTest"];
  };
};
