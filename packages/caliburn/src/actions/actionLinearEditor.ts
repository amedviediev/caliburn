import { invariant } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  isElbowArrow,
  isLinearElement,
} from "@excalidraw/element";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

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
