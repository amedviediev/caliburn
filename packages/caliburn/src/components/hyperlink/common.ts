import { isEmbeddableElement } from "@excalidraw/element";

import { getSelectedElements } from "@excalidraw/excalidraw/scene";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { UIAppState } from "@excalidraw/excalidraw/types";

/**
 * Upstream keeps this next to the `Hyperlink` component (`Hyperlink.tsx`);
 * here it lives in a plain module so `actionLink` can read it without
 * importing the Angular component (which pulls in the editor).
 */
export const getContextMenuLabel = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: UIAppState,
) => {
  const selectedElements = getSelectedElements(elements, appState);
  const label = isEmbeddableElement(selectedElements[0])
    ? "labels.link.editEmbed"
    : selectedElements[0]?.link
    ? "labels.link.edit"
    : "labels.link.create";
  return label;
};
