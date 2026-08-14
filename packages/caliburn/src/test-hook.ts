import { syncInvalidIndices } from "@excalidraw/element";

import type { Scene, Store } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { History } from "@excalidraw/excalidraw/history";
import type { AppState } from "@excalidraw/excalidraw/types";

import type { CaliburnEditorComponent } from "./editor.component";

/**
 * The state handle the test suite drives the editor through. Mirrors the
 * `window.h` contract of the upstream React app so ported tests keep
 * reading and writing the same surface.
 */
export interface TestHandle {
  scene: Scene;
  elements: readonly ExcalidrawElement[];
  state: AppState;
  setState: CaliburnEditorComponent["setState"];
  app: CaliburnEditorComponent;
  history: History;
  store: Store;
}

export const createTestHook = (): TestHandle => {
  const win = window as any;
  win.h = win.h || {};

  Object.defineProperties(win.h, {
    elements: {
      configurable: true,
      get() {
        return this.app?.scene.getElementsIncludingDeleted();
      },
      set(elements: ExcalidrawElement[]) {
        return this.app?.scene.replaceAllElements(syncInvalidIndices(elements));
      },
    },
    scene: {
      configurable: true,
      get() {
        return this.app?.scene;
      },
    },
  });

  return win.h as TestHandle;
};

export const h = createTestHook();
