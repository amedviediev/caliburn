import { KEYS, THEME } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { loadFromJSON, saveAsJSON } from "@excalidraw/excalidraw/data";
import { isImageFileHandle } from "@excalidraw/excalidraw/data/blob";
import { resaveAsImageWithScene } from "@excalidraw/excalidraw/data/resave";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { JSONExportData } from "@excalidraw/excalidraw/data/json";
import type {
  AppClassProperties,
  AppState,
} from "@excalidraw/excalidraw/types";

import { register } from "./register";

export const actionChangeProjectName = register<AppState["name"]>({
  name: "changeProjectName",
  label: "labels.fileTitle",
  trackEvent: false,
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, name: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionChangeExportScale = register<AppState["exportScale"]>({
  name: "changeExportScale",
  label: "imageExportDialog.scale",
  trackEvent: { category: "export", action: "scale" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportScale: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionChangeExportBackground = register<
  AppState["exportBackground"]
>({
  name: "changeExportBackground",
  label: "imageExportDialog.label.withBackground",
  trackEvent: { category: "export", action: "toggleBackground" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportBackground: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionChangeExportEmbedScene = register<
  AppState["exportEmbedScene"]
>({
  name: "changeExportEmbedScene",
  label: "imageExportDialog.tooltip.embedScene",
  trackEvent: { category: "export", action: "embedScene" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportEmbedScene: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

// ---------------------------------------------------------------------------
// Save actions
// ---------------------------------------------------------------------------

let onExportInProgress = false;

/**
 * Upstream additionally lets the host intercept and delay the export through
 * `props.onExport`, rendering its progress into a toast. Caliburn exposes
 * neither the prop nor a toast surface, so the data is resolved directly;
 * the abort controller is kept since the save actions abort it on failure.
 */
const prepareDataForJSONExport = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
): { abortController: AbortController; data: Promise<JSONExportData> } => {
  return {
    abortController: new AbortController(),
    data: Promise.resolve({ elements, appState, files: app.files }),
  };
};

export const actionSaveToActiveFile = register({
  name: "saveToActiveFile",
  label: "buttons.save",
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.saveToActiveFile &&
      !!appState.fileHandle &&
      !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, value, app) => {
    if (onExportInProgress) {
      return false;
    }
    onExportInProgress = true;

    const previousFileHandle = appState.fileHandle;
    const filename = app.getName();

    const { abortController, data: exportedDataPromise } =
      prepareDataForJSONExport(elements, appState, app);

    try {
      const { fileHandle } = isImageFileHandle(previousFileHandle)
        ? await resaveAsImageWithScene(
            exportedDataPromise,
            previousFileHandle,
            filename,
          )
        : await saveAsJSON({
            data: exportedDataPromise,
            filename,
            fileHandle: previousFileHandle,
          });

      return {
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          fileHandle,
          toast: {
            message:
              previousFileHandle && fileHandle?.name
                ? t("toast.fileSavedToFilename").replace(
                    "{filename}",
                    `"${fileHandle.name}"`,
                  )
                : t("toast.fileSaved"),
            duration: 1500,
          },
        },
      };
    } catch (error: any) {
      abortController.abort();

      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return {
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          toast: null,
        },
      };
    } finally {
      onExportInProgress = false;
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
});

export const actionSaveFileToDisk = register({
  name: "saveFileToDisk",
  label: "exportDialog.disk_title",
  viewMode: true,
  trackEvent: { category: "export" },
  perform: async (elements, appState, value, app) => {
    if (onExportInProgress) {
      return false;
    }
    onExportInProgress = true;

    const { abortController, data: exportedDataPromise } =
      prepareDataForJSONExport(elements, appState, app);

    try {
      const { fileHandle: savedFileHandle } = await saveAsJSON({
        data: exportedDataPromise,
        filename: app.getName(),
        fileHandle: null,
      });

      return {
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          openDialog: null,
          fileHandle: savedFileHandle,
          toast: { message: t("toast.fileSaved"), duration: 3000 },
        },
      };
    } catch (error: any) {
      abortController.abort();
      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return {
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          toast: null,
        },
      };
    } finally {
      onExportInProgress = false;
    }
  },
  keyTest: (event) =>
    event.key.toLowerCase() === KEYS.S &&
    event.shiftKey &&
    event[KEYS.CTRL_OR_CMD],
});

export const actionLoadScene = register({
  name: "loadScene",
  label: "buttons.load",
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.loadScene && !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, _, app) => {
    try {
      const {
        elements: loadedElements,
        appState: loadedAppState,
        files,
      } = await loadFromJSON(appState, elements);
      return {
        elements: loadedElements,
        appState: loadedAppState,
        files,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.warn(error);
        return false;
      }
      return {
        elements,
        appState: { ...appState, errorMessage: error.message },
        files: app.files,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.O,
});

export const actionExportWithDarkMode = register<
  AppState["exportWithDarkMode"]
>({
  name: "exportWithDarkMode",
  label: "imageExportDialog.label.darkMode",
  trackEvent: { category: "export", action: "toggleTheme" },
  perform: (_elements, appState, value, app) => {
    app.sessionExportThemeOverride = value ? THEME.DARK : THEME.LIGHT;
    return {
      appState: { ...appState, exportWithDarkMode: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
