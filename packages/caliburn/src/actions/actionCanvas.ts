import { CODES, KEYS, ZOOM_STEP } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getNonDeletedElements,
} from "@excalidraw/element";
import { getCommonBounds } from "@excalidraw/element";

import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";
import {
  constrainScrollState,
  getViewportForZoomWithScrollConstraints,
  zoomToFitBounds,
} from "@excalidraw/excalidraw/viewport";

import type { Bounds } from "@excalidraw/common";
import type { Action } from "@excalidraw/excalidraw/actions/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { register } from "./register";

export const actionZoomIn = register({
  name: "zoomIn",
  label: "buttons.zoomIn",
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (_elements, appState, _, app) => {
    app.requestUnfollow();
    const nextState = {
      ...appState,
      ...getViewportForZoomWithScrollConstraints(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(appState.zoom.value + ZOOM_STEP),
        },
        appState,
      ),
    };
    return {
      appState: nextState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    (event.code === CODES.EQUAL || event.code === CODES.NUM_ADD) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionZoomOut = register({
  name: "zoomOut",
  label: "buttons.zoomOut",
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (_elements, appState, _, app) => {
    app.requestUnfollow();
    const nextState = {
      ...appState,
      ...getViewportForZoomWithScrollConstraints(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(appState.zoom.value - ZOOM_STEP),
        },
        appState,
      ),
    };
    return {
      appState: nextState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    (event.code === CODES.MINUS || event.code === CODES.NUM_SUBTRACT) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionResetZoom = register({
  name: "resetZoom",
  label: "buttons.resetZoom",
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (_elements, appState, _, app) => {
    app.requestUnfollow();
    // reset to 100%, unless a zoom lock floors the zoom higher — then reset to
    // the locked minimum zoom (the lock's resting zoom level)
    const nextZoom = appState.scrollConstraints?.lockZoom
      ? appState.scrollConstraints.zoom
      : 1;
    const nextState = {
      ...appState,
      ...getViewportForZoomWithScrollConstraints(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(nextZoom),
        },
        appState,
      ),
    };
    return {
      appState: nextState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    (event.code === CODES.ZERO || event.code === CODES.NUM_ZERO) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

// under a viewport lock, zoom-to-fit targets the locked box rather than the
// scene elements
const getScrollConstraintsBounds = (
  scrollConstraints: NonNullable<AppState["scrollConstraints"]>,
) => {
  return [
    scrollConstraints.x,
    scrollConstraints.y,
    scrollConstraints.x + scrollConstraints.width,
    scrollConstraints.y + scrollConstraints.height,
  ] as Bounds;
};

// Note, this action differs from actionZoomToFitSelection in that it doesn't
// zoom beyond 100%. In other words, if the content is smaller than viewport
// size, it won't be zoomed in.
export const actionZoomToFitSelectionInViewport: Action = {
  name: "zoomToFitSelectionInViewport",
  label: "labels.zoomToFitViewport",
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (elements, appState, _, app) => {
    app.requestUnfollow();
    const selectedElements = app.scene.getSelectedElements(appState);
    const bounds = selectedElements.length
      ? getCommonBounds(getNonDeletedElements(selectedElements))
      : appState.scrollConstraints
      ? getScrollConstraintsBounds(appState.scrollConstraints)
      : getCommonBounds(getNonDeletedElements(elements));
    const result = zoomToFitBounds({
      bounds,
      appState,
      fit: "scale-down",
      canvasOffsets: app.viewport.getOffsets(),
    });
    return {
      ...result,
      // re-clamp so the fit can't escape an active scroll/zoom lock
      appState: {
        ...result.appState,
        ...constrainScrollState(result.appState),
      },
    };
  },
  keyTest: (event) =>
    event.code === CODES.TWO &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
};

export const actionZoomToFitSelection: Action = {
  name: "zoomToFitSelection",
  label: "helpDialog.zoomToSelection",
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (elements, appState, _, app) => {
    app.requestUnfollow();
    const selectedElements = app.scene.getSelectedElements(appState);
    const bounds = selectedElements.length
      ? getCommonBounds(getNonDeletedElements(selectedElements))
      : appState.scrollConstraints
      ? getScrollConstraintsBounds(appState.scrollConstraints)
      : getCommonBounds(getNonDeletedElements(elements));
    const result = zoomToFitBounds({
      bounds,
      appState,
      fit: "contain",
      canvasOffsets: app.viewport.getOffsets(),
    });
    return {
      ...result,
      // re-clamp so the fit can't escape an active scroll/zoom lock
      appState: {
        ...result.appState,
        ...constrainScrollState(result.appState),
      },
    };
  },
  keyTest: (event) =>
    event.code === CODES.THREE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
};

export const actionZoomToFit: Action = {
  name: "zoomToFit",
  label: "helpDialog.zoomToFit",
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (elements, appState, _, app) => {
    app.requestUnfollow();
    // under a viewport lock, fits the locked box rather than the elements
    const bounds = appState.scrollConstraints
      ? getScrollConstraintsBounds(appState.scrollConstraints)
      : getCommonBounds(getNonDeletedElements(elements));
    const result = zoomToFitBounds({
      bounds,
      appState,
      fit: "scale-down",
      canvasOffsets: app.viewport.getOffsets(),
    });
    return {
      ...result,
      // re-clamp so the fit can't escape an active scroll/zoom lock
      appState: {
        ...result.appState,
        ...constrainScrollState(result.appState),
      },
    };
  },
  keyTest: (event) =>
    event.code === CODES.ONE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
};

export const canvasActions = [
  actionZoomIn,
  actionZoomOut,
  actionResetZoom,
  actionZoomToFitSelectionInViewport,
  actionZoomToFitSelection,
  actionZoomToFit,
];
