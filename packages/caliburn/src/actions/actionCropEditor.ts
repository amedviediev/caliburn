import { CaptureUpdateAction, isImageElement } from "@excalidraw/element";

import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import { register } from "./register";

export const actionToggleCropEditor = register({
  name: "cropEditor",
  label: "helpDialog.cropStart",
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["image", "crop"],
  perform(elements, appState, _, app) {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
    })[0] as ExcalidrawImageElement;

    return {
      appState: {
        ...appState,
        isCropping: false,
        croppingElementId: selectedElement.id,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    if (
      !appState.croppingElementId &&
      selectedElements.length === 1 &&
      isImageElement(selectedElements[0])
    ) {
      return true;
    }
    return false;
  },
});
