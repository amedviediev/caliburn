import type { Action } from "@excalidraw/excalidraw/actions/types";

export let actions: readonly Action[] = [];

/**
 * Mirrors the upstream action registry so copied action modules keep their
 * `register(...)` calls unchanged.
 */
export const register = <T extends Action>(action: T) => {
  actions = actions.concat(action);
  return action as T & {
    keyTest?: unknown;
  };
};
