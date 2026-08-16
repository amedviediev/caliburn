import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getConversionTypeFromElements } from "../components/convert-element-type";

import { register } from "./register";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Port of upstream `actionToggleShapeSwitch.tsx`. Upstream's `icon: () => null`
 * is dropped: caliburn's action icons are registry names resolved in
 * `action-icons.ts`, and this action has no icon there either.
 */
export const actionToggleShapeSwitch = register({
  name: "toggleShapeSwitch",
  label: "labels.shapeSwitch",
  viewMode: true,
  trackEvent: {
    category: "shape_switch",
    action: "toggle",
  },
  keywords: ["change", "switch", "swap"],
  perform(elements, appState, _, app) {
    (app as unknown as CaliburnEditorComponent).convertElementTypePopup.set({
      type: "panel",
    });

    return {
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.gridModeEnabled,
  predicate: (elements, appState, props) =>
    getConversionTypeFromElements(elements as ExcalidrawElement[]) !== null,
});
