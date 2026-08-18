import { KEYS, capitalizeString } from "@excalidraw/common";
import { t } from "@excalidraw/excalidraw/i18n";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import type { AppClassProperties } from "@excalidraw/excalidraw/types";

export type ToolConfig = {
  /** Letter shortcut(s) — the first one is shown in tooltips. */
  letterKey?: string | readonly string[];
  /** Whether `letterKey` requires Shift to be held (for example Shift+X). */
  shiftKey?: boolean;
  numericKey?: string;
  /** Whether the tool's shapes can be filled. */
  fillable?: boolean;
  /** Whether reactivating the tool switches back to the previous tool. */
  toggle?: boolean;
};

const defineTools = <T extends Record<string, ToolConfig>>(tools: T) =>
  tools as { [K in keyof T]: ToolConfig };

/**
 * Framework-neutral mirror of upstream's tool metadata. The upstream table
 * also contains React icon nodes, so importing it would pull React into the
 * Angular package's runtime graph.
 */
export const TOOLS = defineTools({
  hand: { letterKey: KEYS.H, toggle: true },
  selection: {
    letterKey: KEYS.V,
    numericKey: KEYS["1"],
    fillable: true,
  },
  rectangle: {
    letterKey: KEYS.R,
    numericKey: KEYS["2"],
    fillable: true,
  },
  diamond: {
    letterKey: KEYS.D,
    numericKey: KEYS["3"],
    fillable: true,
  },
  ellipse: {
    letterKey: KEYS.O,
    numericKey: KEYS["4"],
    fillable: true,
  },
  arrow: {
    letterKey: KEYS.A,
    numericKey: KEYS["5"],
    fillable: true,
  },
  line: {
    letterKey: KEYS.L,
    numericKey: KEYS["6"],
    fillable: true,
  },
  freedraw: { letterKey: [KEYS.P, KEYS.X], numericKey: KEYS["7"] },
  text: { letterKey: KEYS.T, numericKey: KEYS["8"] },
  image: { numericKey: KEYS["9"] },
  eraser: { letterKey: KEYS.E, numericKey: KEYS["0"], toggle: true },
  frame: { letterKey: KEYS.F },
  autoshape: { letterKey: KEYS.X, shiftKey: true, fillable: false },
  embeddable: {},
  laser: { letterKey: KEYS.K },
  bucketfill: { letterKey: KEYS.B },
  lasso: { fillable: false },
});

export type ToolbarToolType = keyof typeof TOOLS;

export const getToolLetter = (type: ToolbarToolType) => {
  const { letterKey, shiftKey } = TOOLS[type];
  if (!letterKey) {
    return letterKey;
  }
  const letter = capitalizeString(
    typeof letterKey === "string" ? letterKey : letterKey[0],
  );
  return shiftKey ? getShortcutKey(`Shift+${letter}`) : letter;
};

export const getToolShortcut = (type: ToolbarToolType) => {
  const letter = getToolLetter(type);
  const { numericKey } = TOOLS[type];
  return letter && numericKey != null
    ? `${letter} ${t("helpDialog.or")} ${numericKey}`
    : `${letter || numericKey}`;
};

export const findShapeByKey = (
  key: string,
  app: AppClassProperties,
  shiftKey: boolean = false,
) => {
  const lowerKey = key.toLowerCase();

  for (const type of Object.keys(TOOLS) as ToolbarToolType[]) {
    const { letterKey, numericKey, shiftKey: requiresShift } = TOOLS[type];
    if (shiftKey !== Boolean(requiresShift)) {
      continue;
    }
    if (
      (numericKey != null && key === numericKey) ||
      (letterKey &&
        (typeof letterKey === "string"
          ? letterKey === lowerKey
          : letterKey.includes(lowerKey)))
    ) {
      return type === "selection"
        ? app.state.preferredSelectionTool.type
        : type;
    }
  }
  return null;
};

/**
 * The ng-icon registry name of each tool's icon. Names follow the
 * generated registry's convention: the upstream export name with its first
 * character lowercased (see `icons.generated.ts`).
 */
export const TOOL_ICONS: Record<ToolbarToolType, string> = {
  hand: "handIcon",
  selection: "selectionIcon",
  rectangle: "rectangleIcon",
  diamond: "diamondIcon",
  ellipse: "ellipseIcon",
  arrow: "arrowIcon",
  line: "lineIcon",
  freedraw: "freedrawIcon",
  text: "textIcon",
  image: "imageIcon",
  eraser: "eraserIcon",
  frame: "frameToolIcon",
  autoshape: "drawShapeToolIcon",
  embeddable: "embedIcon",
  laser: "laserPointerToolIcon",
  bucketfill: "bucketFillIcon",
  lasso: "lassoIcon",
};
