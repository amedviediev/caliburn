import {
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  getFontString,
  getLineHeight,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  getLineHeightInPx,
  getVisibleSceneBounds,
  makeNextSelectedElementIds,
  measureText,
  newTextElement,
  normalizeText,
  wrapText,
} from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { getTopLayerFrameAtSceneCoords } from "./text-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

export const addTextFromPaste = (
  editor: CaliburnEditorComponent,
  text: string,
  isPlainPaste = false,
) => {
  const { x, y } = viewportCoordsToSceneCoords(
    {
      clientX: editor.viewport.lastPosition.x,
      clientY: editor.viewport.lastPosition.y,
    },
    editor.state,
  );

  const textElementProps = {
    x,
    y,
    strokeColor: editor.state.currentItemStrokeColor,
    backgroundColor: editor.state.currentItemBackgroundColor,
    fillStyle: editor.state.currentItemFillStyle,
    strokeWidth: editor.getCurrentItemStrokeWidth("text"),
    strokeStyle: editor.state.currentItemStrokeStyle,
    roundness: null,
    roughness: editor.state.currentItemRoughness,
    opacity: editor.state.currentItemOpacity,
    text,
    fontSize: editor.state.currentItemFontSize,
    fontFamily: editor.state.currentItemFontFamily,
    textAlign: DEFAULT_TEXT_ALIGN,
    verticalAlign: DEFAULT_VERTICAL_ALIGN,
    locked: false,
  };
  const fontString = getFontString({
    fontSize: textElementProps.fontSize,
    fontFamily: textElementProps.fontFamily,
  });
  const lineHeight = getLineHeight(textElementProps.fontFamily);
  const [x1, , x2] = getVisibleSceneBounds(editor.state);
  // long texts should not go beyond 800 pixels in width nor should it go below 200 px
  const maxTextWidth = Math.max(Math.min((x2 - x1) * 0.5, 800), 200);
  const LINE_GAP = 10;
  let currentY = y;

  const lines = isPlainPaste ? [text] : text.split("\n");
  const textElements = lines.reduce(
    (acc: ExcalidrawTextElement[], line, idx) => {
      const originalText = normalizeText(line).trim();
      if (originalText.length) {
        const topLayerFrame = getTopLayerFrameAtSceneCoords(editor, {
          x,
          y: currentY,
        });

        let metrics = measureText(originalText, fontString, lineHeight);
        const isTextUnwrapped = metrics.width > maxTextWidth;

        const text = isTextUnwrapped
          ? wrapText(originalText, fontString, maxTextWidth)
          : originalText;

        metrics = isTextUnwrapped
          ? measureText(text, fontString, lineHeight)
          : metrics;

        const startX = x - metrics.width / 2;
        const startY = currentY - metrics.height / 2;

        const element = newTextElement({
          ...textElementProps,
          x: startX,
          y: startY,
          text,
          originalText,
          lineHeight,
          autoResize: !isTextUnwrapped,
          frameId: topLayerFrame ? topLayerFrame.id : null,
        });
        acc.push(element);
        currentY += element.height + LINE_GAP;
      } else {
        const prevLine = lines[idx - 1]?.trim();
        // add paragraph only if previous line was not empty, IOW don't add
        // more than one empty line
        if (prevLine) {
          currentY +=
            getLineHeightInPx(textElementProps.fontSize, lineHeight) + LINE_GAP;
        }
      }

      return acc;
    },
    [],
  );

  if (textElements.length === 0) {
    return;
  }

  editor.insertNewElements(textElements);
  editor.store.scheduleCapture();
  editor.setState({
    selectedElementIds: makeNextSelectedElementIds(
      Object.fromEntries(textElements.map((el) => [el.id, true])),
      editor.state,
    ),
  });
};
