import { atom } from "@excalidraw/excalidraw/editor-jotai";

import type { LibraryItem } from "@excalidraw/excalidraw/types";

export type SvgCache = Map<LibraryItem["id"], SVGSVGElement>;

/** Framework-neutral part of upstream's `useLibraryItemSvg` module. */
export const libraryItemSvgsCache = atom<SvgCache>(new Map());
