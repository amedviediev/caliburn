import { isPromiseLike } from "@excalidraw/common";

import { trackEvent } from "@excalidraw/excalidraw/analytics";

import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import type { AppState } from "@excalidraw/excalidraw/types";
import type {
  Action,
  UpdaterFn,
  ActionName,
  ActionResult,
  ActionSource,
} from "@excalidraw/excalidraw/actions/types";

import type { CaliburnEditorComponent } from "../editor.component";

const trackAction = (
  action: Action,
  source: ActionSource,
  appState: Readonly<AppState>,
  elements: readonly ExcalidrawElement[],
  app: CaliburnEditorComponent,
  value: any,
) => {
  if (action.trackEvent) {
    try {
      if (typeof action.trackEvent === "object") {
        const shouldTrack = action.trackEvent.predicate
          ? action.trackEvent.predicate(appState, elements, value)
          : true;
        if (shouldTrack) {
          trackEvent(
            action.trackEvent.category,
            action.trackEvent.action || action.name,
            `${source} (${
              app.editorInterface.formFactor === "phone" ? "mobile" : "desktop"
            })`,
          );
        }
      }
    } catch (error) {
      console.error("error while logging action:", error);
    }
  }
};

export class ActionManager {
  actions = {} as Record<ActionName, Action>;

  updater: (actionResult: ActionResult | Promise<ActionResult>) => void;

  getAppState: () => Readonly<AppState>;
  getElementsIncludingDeleted: () => readonly OrderedExcalidrawElement[];
  app: CaliburnEditorComponent;

  constructor(
    updater: UpdaterFn,
    getAppState: () => AppState,
    getElementsIncludingDeleted: () => readonly OrderedExcalidrawElement[],
    app: CaliburnEditorComponent,
  ) {
    this.updater = (actionResult) => {
      if (isPromiseLike(actionResult)) {
        actionResult.then((actionResult) => {
          return updater(actionResult);
        });
      } else {
        return updater(actionResult);
      }
    };
    this.getAppState = getAppState;
    this.getElementsIncludingDeleted = getElementsIncludingDeleted;
    this.app = app;
  }

  registerAction(action: Action) {
    this.actions[action.name] = action;
  }

  registerAll(actions: readonly Action[]) {
    actions.forEach((action) => this.registerAction(action));
  }

  private isActionBlockedByViewportTransition = (action: Action) =>
    action.navigation === true && this.app.viewport.isLockedTransitionPending;

  handleKeyDown(event: KeyboardEvent) {
    if (!this.app.isInteractionEnabled() && !this.app.isNavigationEnabled()) {
      return false;
    }

    const canvasActions = this.app.props.UIOptions.canvasActions;
    const data = Object.values(this.actions)
      .sort((a, b) => (b.keyPriority || 0) - (a.keyPriority || 0))
      .filter(
        (action) =>
          (action.name in canvasActions
            ? canvasActions[action.name as keyof typeof canvasActions]
            : true) &&
          action.keyTest &&
          action.keyTest(
            event,
            this.getAppState(),
            this.getElementsIncludingDeleted(),
            this.app as any,
          ),
      );

    if (data.length !== 1) {
      if (data.length > 1) {
        console.warn("Canceling as multiple actions match this shortcut", data);
      }
      return false;
    }

    const action = data[0];

    // in the non-interactive editor, only navigation actions are allowed
    // (when navigation itself is)
    if (!this.app.isInteractionEnabled() && action.navigation !== true) {
      return false;
    }

    if (this.getAppState().viewModeEnabled && action.viewMode !== true) {
      return false;
    }

    if (this.isActionBlockedByViewportTransition(action)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    const elements = this.getElementsIncludingDeleted();
    const appState = this.getAppState();

    trackAction(action, "keyboard", appState, elements, this.app, null);

    event.preventDefault();
    event.stopPropagation();
    this.updater(data[0].perform(elements, appState, null, this.app as any));
    return true;
  }

  executeAction<T extends Action>(
    action: T,
    source: ActionSource = "api",
    value: Parameters<T["perform"]>[2] = null,
  ) {
    // the user must not be able to affect a non-interactive editor
    // (programmatic execution by the host remains allowed, as are
    // navigation actions when navigation is)
    if (
      source !== "api" &&
      !this.app.isInteractionEnabled() &&
      !(this.app.isNavigationEnabled() && action.navigation === true)
    ) {
      return;
    }

    if (this.isActionBlockedByViewportTransition(action)) {
      return;
    }

    const elements = this.getElementsIncludingDeleted();
    const appState = this.getAppState();

    trackAction(action, source, appState, elements, this.app, value);

    this.updater(action.perform(elements, appState, value, this.app as any));
  }

  isActionEnabled = (action: Action) => {
    const elements = this.getElementsIncludingDeleted();
    const appState = this.getAppState();

    return (
      !action.predicate ||
      action.predicate(
        elements,
        appState,
        this.app.props as any,
        this.app as any,
      )
    );
  };
}
