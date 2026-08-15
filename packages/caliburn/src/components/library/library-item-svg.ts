import { COLOR_PALETTE } from "@excalidraw/common";

import { exportToSvg } from "@excalidraw/utils/export";

import type { LibraryItem } from "@excalidraw/excalidraw/types";

export type SvgCache = Map<LibraryItem["id"], SVGSVGElement>;

/**
 * Angular port of upstream `hooks/useLibraryItemSvg.ts`.
 *
 * Upstream keeps the cache in a jotai atom declared in that hook module,
 * which caliburn cannot import (the module pulls in React); it is a plain
 * module-level map here instead, cleared from the editor's teardown the way
 * upstream's `Library.destroy()` resets the atom.
 */
export const libraryItemSvgCache: SvgCache = new Map();

export const clearLibraryItemSvgCache = () => libraryItemSvgCache.clear();

export const deleteItemsFromLibraryItemSvgCache = (
  ids: LibraryItem["id"][],
) => {
  ids.forEach((id) => libraryItemSvgCache.delete(id));
};

const exportLibraryItemToSvg = async (elements: LibraryItem["elements"]) => {
  // TODO should pass theme (appState.exportWithDark) - we're still using
  // CSS filter here
  return await exportToSvg({
    elements,
    appState: {
      exportBackground: false,
      viewBackgroundColor: COLOR_PALETTE.white,
    },
    files: null,
    renderEmbeddables: false,
    skipInliningFonts: true,
  });
};

/**
 * Upstream's `useLibraryItemSvg` effect: resolves the item's preview, going
 * through the cache when the item has an id.
 */
export const getLibraryItemSvg = async (
  id: LibraryItem["id"] | null,
  elements: LibraryItem["elements"] | undefined,
): Promise<SVGSVGElement | undefined> => {
  if (!elements) {
    return undefined;
  }

  if (!id) {
    // When we have no id (usualy selected items from canvas) just export the svg
    return exportLibraryItemToSvg(elements);
  }

  const cachedSvg = libraryItemSvgCache.get(id);
  if (cachedSvg) {
    return cachedSvg;
  }

  const exportedSvg = await exportLibraryItemToSvg(elements);
  // TODO: should likely be removed for custom fonts
  exportedSvg.querySelector(".style-fonts")?.remove();

  libraryItemSvgCache.set(id, exportedSvg);

  return exportedSvg;
};
