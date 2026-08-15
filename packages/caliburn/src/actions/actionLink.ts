import { getNonDeletedElements } from "@excalidraw/element";

import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { getSelectedElements } from "@excalidraw/excalidraw/scene";

import { getContextMenuLabel } from "../components/hyperlink/common";

import { register } from "./register";

export const actionLink = register({
  name: "hyperlink",
  label: (elements, appState) =>
    getContextMenuLabel(getNonDeletedElements(elements), appState),
  perform: (elements, appState) => {
    if (appState.showHyperlinkPopup === "editor") {
      return false;
    }

    return {
      elements,
      appState: {
        ...appState,
        showHyperlinkPopup: "editor",
        openMenu: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  trackEvent: { category: "hyperlink", action: "click" },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.K,
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return selectedElements.length === 1;
  },
});
