import {
  KEYS,
  matchKey,
  arrayToMap,
  MOBILE_ACTION_BUTTON_BG,
} from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { orderByFractionalIndex } from "@excalidraw/element";

import { HistoryChangedEvent } from "@excalidraw/excalidraw/history";
import { useEmitter } from "@excalidraw/excalidraw/hooks/useEmitter";
import { t } from "@excalidraw/excalidraw/i18n";

import type { SceneElementsMap } from "@excalidraw/element/types";

import type { History } from "@excalidraw/excalidraw/history";
import type {
  AppClassProperties,
  AppState,
} from "@excalidraw/excalidraw/types";
import type {
  Action,
  ActionResult,
} from "@excalidraw/excalidraw/actions/types";

const executeHistoryAction = (
  app: AppClassProperties,
  appState: Readonly<AppState>,
  updater: () => [SceneElementsMap, AppState] | void,
): ActionResult => {
  if (
    !appState.multiElement &&
    !appState.resizingElement &&
    !appState.editingTextElement &&
    !appState.newElement &&
    !appState.selectedElementsAreBeingDragged &&
    !appState.selectionElement &&
    !app.flowchart.isCreatingChart &&
    // a drawShape sketch in progress isn't visible via `newElement` while
    // the stroke is still unrecognized — block history mid-gesture the same
    // way as for the other in-progress interactions above
    !app.drawShape.hasPendingGesture()
  ) {
    const result = updater();

    if (!result) {
      return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
    }

    const [nextElementsMap, nextAppState] = result;

    // order by fractional indices in case the map was accidently modified in the meantime
    const nextElements = orderByFractionalIndex(
      Array.from(nextElementsMap.values()),
    );

    return {
      appState: nextAppState,
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  }

  return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
};

type ActionCreator = (history: History) => Action;

export const createUndoAction: ActionCreator = (history) => ({
  name: "undo",
  label: "buttons.undo",
  trackEvent: { category: "history" },
  viewMode: false,
  perform: (elements, appState, value, app) =>
    executeHistoryAction(app, appState, () =>
      history.undo(arrayToMap(elements) as SceneElementsMap, appState),
    ),
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && matchKey(event, KEYS.Z) && !event.shiftKey,
});

export const createRedoAction: ActionCreator = (history) => ({
  name: "redo",
  label: "buttons.redo",
  trackEvent: { category: "history" },
  viewMode: false,
  perform: (elements, appState, __, app) =>
    executeHistoryAction(app, appState, () =>
      history.redo(arrayToMap(elements) as SceneElementsMap, appState),
    ),
  keyTest: (event) =>
    (event[KEYS.CTRL_OR_CMD] && event.shiftKey && matchKey(event, KEYS.Z)) ||
    (event[KEYS.CTRL_OR_CMD] && !event.shiftKey && matchKey(event, KEYS.Y)),
});
