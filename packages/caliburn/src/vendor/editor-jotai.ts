import { atom, createStore } from "jotai/vanilla";

import type { PrimitiveAtom, WritableAtom } from "jotai/vanilla";

/**
 * Framework-neutral replacement for upstream `excalidraw/editor-jotai.ts`.
 *
 * Upstream wraps the store in `jotai-scope`'s `createIsolation()`, which
 * exists to scope a React context and hands back a Provider plus `useAtom`
 * and friends. Angular reaches the store directly, so none of that is
 * reachable here — but `createIsolation()` is called at module scope, so it
 * cannot tree-shake, and `jotai-scope` depends on `react` outright.
 *
 * Importing from `jotai/vanilla` instead keeps `atom` and `createStore`
 * (identical implementations) while leaving React out of the dependency tree
 * entirely: `jotai` itself has no dependencies and declares React only as an
 * optional peer.
 */
export { atom };

export type { PrimitiveAtom, WritableAtom };

export const editorJotaiStore: ReturnType<typeof createStore> = createStore();

/**
 * The React half of upstream's surface. Vendored modules still import these
 * — `i18n.ts`'s `useI18n`, for one — so the names have to exist for Rollup to
 * resolve them, but every caller is a React hook or component that Caliburn
 * replaces with an Angular equivalent. Rollup drops them as dead code; the
 * throw is here so that a future vendored module that genuinely reaches one
 * fails immediately instead of silently doing nothing.
 */
const reactOnly = (name: string) => (): never => {
  throw new Error(
    `${name} is React-only and unavailable in Caliburn; read editorJotaiStore directly.`,
  );
};

export const useAtom = reactOnly("useAtom");
export const useAtomValue = reactOnly("useAtomValue");
export const useSetAtom = reactOnly("useSetAtom");
export const useStore = reactOnly("useStore");
export const EditorJotaiProvider = reactOnly("EditorJotaiProvider");
