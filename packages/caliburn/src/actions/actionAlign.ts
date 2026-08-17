import { getNonDeletedElements } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import { updateFrameMembershipOfSelectedElements } from "@excalidraw/element";

import { KEYS, arrayToMap } from "@excalidraw/common";

import { alignElements } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { getSelectedElementsByGroup } from "@excalidraw/element";

import { isSomeElementSelected } from "@excalidraw/excalidraw/scene";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Alignment } from "@excalidraw/element";

import type {
  AppClassProperties,
  AppState,
  UIAppState,
} from "@excalidraw/excalidraw/types";

import { register } from "./register";

export const alignActionsPredicate = (
  appState: UIAppState,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  return (
    getSelectedElementsByGroup(
      selectedElements,
      app.scene.getNonDeletedElementsMap(),
      appState as Readonly<AppState>,
    ).length > 1 &&
    // TODO enable aligning frames when implemented properly
    !selectedElements.some((el) => isFrameLikeElement(el))
  );
};

/** upstream's `PanelComponent` renders the button while some element is
 * selected and hides it unless the align predicate holds; the Angular panel
 * asks for the same pair through this helper */
export const alignActionVisible = (
  elements: readonly ExcalidrawElement[],
  appState: UIAppState,
) => isSomeElementSelected(getNonDeletedElements(elements), appState);

const alignSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
  alignment: Alignment,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);

  const updatedElements = alignElements(
    selectedElements,
    alignment,
    app.scene,
    appState,
  );

  const updatedElementsMap = arrayToMap(updatedElements);

  return updateFrameMembershipOfSelectedElements(
    elements.map((element) => updatedElementsMap.get(element.id) || element),
    appState,
    app,
  );
};

export const actionAlignTop = register({
  name: "alignTop",
  label: "labels.alignTop",
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "start",
        axis: "y",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_UP,
});

export const actionAlignBottom = register({
  name: "alignBottom",
  label: "labels.alignBottom",
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "end",
        axis: "y",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_DOWN,
});

export const actionAlignLeft = register({
  name: "alignLeft",
  label: "labels.alignLeft",
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "start",
        axis: "x",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_LEFT,
});

export const actionAlignRight = register({
  name: "alignRight",
  label: "labels.alignRight",
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "end",
        axis: "x",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.ARROW_RIGHT,
});

export const actionAlignVerticallyCentered = register({
  name: "alignVerticallyCentered",
  label: "labels.centerVertically",
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "center",
        axis: "y",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionAlignHorizontallyCentered = register({
  name: "alignHorizontallyCentered",
  label: "labels.centerHorizontally",
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    alignActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: alignSelectedElements(elements, appState, app, {
        position: "center",
        axis: "x",
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
