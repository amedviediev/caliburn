import { MIME_TYPES } from "@excalidraw/common";

import { eyeDropperIconSvgPaths } from "@excalidraw/excalidraw/components/icons";

import type { ColorPickerType } from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";

const eyeDropperCursorPaths = eyeDropperIconSvgPaths
  .map((path, idx) => `<path fill="${idx === 0 ? `#fff` : ``}" d="${path}" />`)
  .join("");

export const eyeDropperCursor = `url(data:${
  MIME_TYPES.svg
},${encodeURIComponent(
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="5">${eyeDropperCursorPaths}</g><g stroke="#1b1b1f" stroke-width="1.25">${eyeDropperCursorPaths}</g></svg>`,
)}) 2 21, auto`;

export type EyeDropperProperties = {
  keepOpenOnAlt: boolean;
  swapPreviewOnAlt?: boolean;
  /** called when user picks color (on pointerup) */
  onSelect: (color: string, event: PointerEvent) => void;
  /**
   * property of selected elements to update live when alt-dragging.
   * Supply `null` if not applicable (e.g. updating the canvas bg instead of
   * elements)
   **/
  colorPickerType: ColorPickerType;
};
