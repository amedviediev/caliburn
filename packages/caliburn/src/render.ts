import { renderInteractiveScene } from "@excalidraw/excalidraw/renderer/interactiveScene";
import { renderNewElementScene } from "@excalidraw/excalidraw/renderer/renderNewElementScene";
import { renderStaticScene } from "@excalidraw/excalidraw/renderer/staticScene";
import { AnimationController } from "@excalidraw/excalidraw/renderer/animation";

import { isGridModeEnabled } from "@excalidraw/excalidraw/snapping";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type {
  InteractiveCanvasRenderConfig,
  InteractiveSceneRenderAnimationState,
  InteractiveSceneRenderConfig,
  StaticCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";

import type { InteractiveCanvasAppState } from "@excalidraw/excalidraw/types";

import type { CaliburnEditorComponent } from "./editor.component";

export const INTERACTIVE_SCENE_ANIMATION_KEY = "animateInteractiveScene";

/**
 * The upstream flag, minus the React-version check (which only exists to
 * work around a React 17 issue).
 */
export const isRenderThrottlingEnabled = () =>
  (window as { EXCALIDRAW_THROTTLE_RENDER?: boolean })
    .EXCALIDRAW_THROTTLE_RENDER === true;

const sizeCanvas = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  scale: number,
) => {
  const pixelWidth = Math.floor(width * scale);
  const pixelHeight = Math.floor(height * scale);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  if (canvas.style.width !== `${width}px`) {
    canvas.style.width = `${width}px`;
  }
  if (canvas.style.height !== `${height}px`) {
    canvas.style.height = `${height}px`;
  }
};

const interactiveRendererParams = new WeakMap<
  CaliburnEditorComponent,
  InteractiveSceneRenderConfig
>();

/** the params the interactive scene was last rendered with — upstream keeps
 * these in `InteractiveCanvas`'s `rendererParams` ref */
export const getInteractiveRendererParams = (editor: CaliburnEditorComponent) =>
  interactiveRendererParams.get(editor);

/**
 * Upstream `InteractiveCanvas.tsx`'s derivation of the remote-collaborator
 * half of `InteractiveCanvasRenderConfig` from `appState.collaborators` — the
 * remote cursors, their usernames/idle states and their selections.
 */
export const getRemoteCollaboratorRenderConfig = (
  appState: InteractiveCanvasAppState,
): Pick<
  InteractiveCanvasRenderConfig,
  | "remotePointerViewportCoords"
  | "remotePointerButton"
  | "remoteSelectedElementIds"
  | "remotePointerUsernames"
  | "remotePointerUserStates"
> => {
  const remotePointerButton: InteractiveCanvasRenderConfig["remotePointerButton"] =
    new Map();
  const remotePointerViewportCoords: InteractiveCanvasRenderConfig["remotePointerViewportCoords"] =
    new Map();
  const remoteSelectedElementIds: InteractiveCanvasRenderConfig["remoteSelectedElementIds"] =
    new Map();
  const remotePointerUsernames: InteractiveCanvasRenderConfig["remotePointerUsernames"] =
    new Map();
  const remotePointerUserStates: InteractiveCanvasRenderConfig["remotePointerUserStates"] =
    new Map();

  appState.collaborators.forEach((user, socketId) => {
    if (user.selectedElementIds) {
      for (const id of Object.keys(user.selectedElementIds)) {
        if (!remoteSelectedElementIds.has(id)) {
          remoteSelectedElementIds.set(id, []);
        }
        remoteSelectedElementIds.get(id)!.push(socketId);
      }
    }
    if (!user.pointer || user.pointer.renderCursor === false) {
      return;
    }
    if (user.username) {
      remotePointerUsernames.set(socketId, user.username);
    }
    if (user.userState) {
      remotePointerUserStates.set(socketId, user.userState);
    }
    remotePointerViewportCoords.set(
      socketId,
      sceneCoordsToViewportCoords(
        {
          sceneX: user.pointer.x,
          sceneY: user.pointer.y,
        },
        appState,
      ),
    );
    remotePointerButton.set(socketId, user.button);
  });

  return {
    remotePointerViewportCoords,
    remotePointerButton,
    remoteSelectedElementIds,
    remotePointerUsernames,
    remotePointerUserStates,
  };
};

/**
 * One full render pass over the three canvases — the Angular equivalent of
 * upstream's `<StaticCanvas>`, `<NewElementCanvas>` and `<InteractiveCanvas>`
 * effects. Driven from the editor's commit path, which fires on every state
 * or scene change (the same cadence as upstream's React commits).
 */
export const renderEditor = (editor: CaliburnEditorComponent) => {
  const staticCanvas = editor.staticCanvasRef()?.nativeElement;
  const interactiveCanvas = editor.interactiveCanvasRef()?.nativeElement;
  const newElementCanvas = editor.newElementCanvasRef()?.nativeElement;
  const rc = editor.rc;

  if (!staticCanvas || !interactiveCanvas || !newElementCanvas || !rc) {
    return;
  }

  const scale = window.devicePixelRatio;
  const selectedElements = editor.scene.getSelectedElements(editor.state);

  const {
    elementsMap: renderableElementsMap,
    visibleElements,
    /**
     * element to draw on the new-element canvas for optimization purposes.
     * Can be null even if state.newElement is defined
     * (e.g. when its zIndex isn't on top) */
    newElementCanvasElement,
  } = editor.renderer.getRenderableElements({
    zoom: editor.state.zoom,
    offsetLeft: editor.state.offsetLeft,
    offsetTop: editor.state.offsetTop,
    scrollX: editor.state.scrollX,
    scrollY: editor.state.scrollY,
    height: editor.state.height,
    width: editor.state.width,
    editingTextElement: editor.state.editingTextElement,
    newElement: editor.state.newElement,
    selectedElements,
    selectedElementsAreBeingDragged:
      editor.state.selectedElementsAreBeingDragged,
    frameToHighlight: editor.state.frameToHighlight,
  });

  editor.visibleElements = visibleElements;
  editor.hasRenderableElements = renderableElementsMap.size > 0;

  const allElementsMap = editor.scene.getNonDeletedElementsMap();

  sizeCanvas(staticCanvas, editor.state.width, editor.state.height, scale);
  sizeCanvas(interactiveCanvas, editor.state.width, editor.state.height, scale);

  const staticRenderConfig: StaticCanvasRenderConfig = {
    imageCache: editor.imageCache,
    isExporting: false,
    renderGrid: isGridModeEnabled(editor as any),
    renderLinks: editor.isLinksEnabled(),
    canvasBackgroundColor: editor.state.viewBackgroundColor,
    embedsValidationStatus: editor.embedsValidationStatus,
    elementsPendingErasure: editor.elementsPendingErasure,
    pendingFlowchartNodes: null,
    theme: editor.state.theme,
  };

  renderStaticScene(
    {
      canvas: staticCanvas,
      rc,
      scale,
      elementsMap: renderableElementsMap,
      allElementsMap,
      visibleElements,
      appState: editor.state,
      renderConfig: staticRenderConfig,
    },
    isRenderThrottlingEnabled(),
  );

  if (newElementCanvasElement) {
    newElementCanvas.style.display = "";
    sizeCanvas(
      newElementCanvas,
      editor.state.width,
      editor.state.height,
      scale,
    );
    renderNewElementScene(
      {
        canvas: newElementCanvas,
        scale,
        newElement: newElementCanvasElement,
        elementsMap: renderableElementsMap,
        allElementsMap,
        rc,
        renderConfig: {
          ...staticRenderConfig,
          renderGrid: false,
        },
        appState: editor.state,
      },
      isRenderThrottlingEnabled(),
    );
  } else if (newElementCanvas.style.display !== "none") {
    newElementCanvas.style.display = "none";
    newElementCanvas
      .getContext("2d")
      ?.clearRect(0, 0, newElementCanvas.width, newElementCanvas.height);
  }

  const remoteCollaborators = getRemoteCollaboratorRenderConfig(editor.state);

  const container = editor.containerRef()?.nativeElement;
  const selectionColor =
    (container &&
      getComputedStyle(container).getPropertyValue("--color-selection")) ||
    "#6965db";

  interactiveRendererParams.set(editor, {
    app: editor as any,
    canvas: interactiveCanvas,
    elementsMap: renderableElementsMap,
    visibleElements,
    selectedElements,
    allElementsMap,
    scale,
    appState: editor.state,
    renderConfig: {
      ...remoteCollaborators,
      selectionColor,
      renderScrollbars: false,
      // NOTE read live so we don't rerender on cursor move
      lastViewportPosition: editor.viewport.lastPosition,
    },
    editorInterface: editor.editorInterface,
    callback: editor.renderInteractiveSceneCallback,
    animationState: {
      bindingHighlight: undefined,
    },
    deltaTime: 0,
  });

  if (!AnimationController.running(INTERACTIVE_SCENE_ANIMATION_KEY)) {
    AnimationController.start<InteractiveSceneRenderAnimationState>(
      INTERACTIVE_SCENE_ANIMATION_KEY,
      ({ deltaTime, state }) => {
        const params = interactiveRendererParams.get(editor);
        if (!params || editor.unmounted) {
          return undefined;
        }
        const nextAnimationState = renderInteractiveScene({
          ...params,
          deltaTime,
          animationState: state,
        }).animationState;

        if (nextAnimationState) {
          for (const key in nextAnimationState) {
            if (
              nextAnimationState[
                key as keyof InteractiveSceneRenderAnimationState
              ] !== undefined
            ) {
              return nextAnimationState;
            }
          }
        }

        return undefined;
      },
    );
  }
};
