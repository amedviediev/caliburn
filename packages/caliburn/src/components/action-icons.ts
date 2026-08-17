import { THEME } from "@excalidraw/common";

import { getSelectedElements } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Action } from "@excalidraw/excalidraw/actions/types";
import type { AppState } from "@excalidraw/excalidraw/types";

/**
 * The ng-icon registry name of the React node upstream's actions carry on
 * `action.icon` — caliburn's ported actions can't hold one, so callers
 * (the command palette, the shape-actions panel) resolve it by action name
 * here. The entries that read the theme or the selection are upstream's
 * `(appState, elements) => ...` icon functions. Shared rather than
 * duplicated because both call sites need the exact same mapping.
 */
export const getActionIconName = (
  action: Action,
  appState: AppState,
  elements: readonly ExcalidrawElement[],
) => {
  const isDark = appState.theme === THEME.DARK;

  switch (action.name) {
    case "group":
      return isDark ? "groupIconDark" : "groupIconLight";
    case "ungroup":
      return isDark ? "ungroupIconDark" : "ungroupIconLight";
    case "cut":
      return "cutIcon";
    case "copy":
    case "duplicateSelection":
      return "duplicateIcon";
    case "deleteSelectedElements":
    case "clearCanvas":
      return "trashIcon";
    case "bringToFront":
      return "bringToFrontIcon";
    case "bringForward":
      return "bringForwardIcon";
    case "sendBackward":
      return "sendBackwardIcon";
    case "sendToBack":
      return "sendToBackIcon";
    case "alignTop":
      return "alignTopIcon";
    case "alignBottom":
      return "alignBottomIcon";
    case "alignLeft":
      return "alignLeftIcon";
    case "alignRight":
      return "alignRightIcon";
    case "alignVerticallyCentered":
      return "centerVerticallyIcon";
    case "alignHorizontallyCentered":
      return "centerHorizontallyIcon";
    case "cropEditor":
      return "cropIcon";
    case "togglePolygon":
      return "polygonIcon";
    case "flipHorizontal":
      return "flipHorizontal";
    case "flipVertical":
      return "flipVertical";
    case "zoomToFit":
    case "zoomToFitSelection":
    case "zoomToFitSelectionInViewport":
      return "zoomAreaIcon";
    case "increaseFontSize":
    case "decreaseFontSize":
      return "fontSizeIcon";
    case "undo":
      return "undoIcon";
    case "redo":
      return "redoIcon";
    case "zoomIn":
      return "zoomInIcon";
    case "zoomOut":
      return "zoomOutIcon";
    case "resetZoom":
      return "zoomResetIcon";
    case "toggleShortcuts":
      return "helpIconThin";
    case "selectAll":
      return "selectAllIcon";
    case "toggleElementLock":
      return getSelectedElements(elements, appState).every((el) => !el.locked)
        ? "lockedIcon"
        : "unlockedIcon";
    case "unlockAllElements":
      return "unlockedIcon";
    case "saveToActiveFile":
    case "saveFileToDisk":
      return "exportIcon";
    case "toggleTheme":
      return isDark ? "sunIcon" : "moonIcon";
    case "searchMenu":
      return "searchIcon";
    case "copyStyles":
    case "pasteStyles":
      return "paintIcon";
    case "gridMode":
      return "gridIcon";
    case "objectsSnapMode":
      return "magnetIcon";
    case "zenMode":
      return "coffeeIcon";
    case "viewMode":
      return "eyeIcon";
    case "stats":
      return "abacusIcon";
    case "hyperlink":
      return "linkIcon";
    case "copyElementLink":
      return "copyIcon";
    case "linkToElement":
      return "elementLinkIcon";
    default:
      return undefined;
  }
};
