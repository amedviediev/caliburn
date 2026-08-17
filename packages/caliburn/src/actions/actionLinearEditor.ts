import { arrayToMap, invariant } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  isElbowArrow,
  isLineElement,
  isLinearElement,
  newElementWith,
  toggleLinePolygonState,
} from "@excalidraw/element";

import type {
  ExcalidrawLineElement,
  ExcalidrawLinearElement,
} from "@excalidraw/element/types";

import { DEFAULT_CATEGORIES } from "../components/command-palette/categories";

import { register } from "./register";

export const actionToggleLinearEditor = register({
  name: "toggleLinearEditor",
  category: DEFAULT_CATEGORIES.elements,
  label: (elements, appState, app) => {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    })[0] as ExcalidrawLinearElement | undefined;

    return selectedElement?.type === "arrow"
      ? "labels.lineEditor.editArrow"
      : "labels.lineEditor.edit";
  },
  keywords: ["line"],
  trackEvent: {
    category: "element",
  },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    if (
      !appState.selectedLinearElement?.isEditing &&
      selectedElements.length === 1 &&
      isLinearElement(selectedElements[0]) &&
      !isElbowArrow(selectedElements[0])
    ) {
      return true;
    }
    return false;
  },
  perform(elements, appState, _, app) {
    invariant(
      appState.selectedLinearElement,
      "No selected linear element found",
    );

    const selectedElement = app.scene.getElement(
      appState.selectedLinearElement.elementId,
    ) as ExcalidrawLinearElement | null;

    invariant(selectedElement, "No selected element found");

    const selectedLinearElement = {
      ...appState.selectedLinearElement,
      isEditing: !appState.selectedLinearElement.isEditing,
    };

    return {
      appState: {
        ...appState,
        selectedLinearElement,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTogglePolygon = register({
  name: "togglePolygon",
  category: DEFAULT_CATEGORIES.elements,
  keywords: ["loop"],
  label: (elements, appState, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    const allPolygons = !selectedElements.some(
      (element) => !isLineElement(element) || !element.polygon,
    );

    return allPolygons
      ? "labels.polygon.breakPolygon"
      : "labels.polygon.convertToPolygon";
  },
  trackEvent: {
    category: "element",
  },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    return (
      selectedElements.length > 0 &&
      selectedElements.every(
        (element) => isLineElement(element) && element.points.length >= 4,
      )
    );
  },
  perform(elements, appState, _, app) {
    const selectedElements = app.scene.getSelectedElements(appState);

    if (selectedElements.some((element) => !isLineElement(element))) {
      return false;
    }

    const targetElements = selectedElements as ExcalidrawLineElement[];

    // if one element not a polygon, convert all to polygon
    const nextPolygonState = targetElements.some((element) => !element.polygon);

    const targetElementsMap = arrayToMap(targetElements);

    return {
      elements: elements.map((element) => {
        if (!targetElementsMap.has(element.id) || !isLineElement(element)) {
          return element;
        }

        return newElementWith(element, {
          backgroundColor: nextPolygonState
            ? element.backgroundColor
            : "transparent",
          ...toggleLinePolygonState(element, nextPolygonState),
        });
      }),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
