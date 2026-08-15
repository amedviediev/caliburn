import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

import {
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_UI_OPTIONS,
  arrayToMap,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  Emitter,
  MIME_TYPES,
  MIN_ZOOM,
  POINTER_BUTTON,
  TOOL_TYPE,
  ZOOM_STEP,
  debounce,
  getStrokeWidthByKey,
  isInputLike,
  isSelectionLikeTool,
  isWritableElement,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  Scene,
  Store,
  getFrameChildrenInsertionIndex,
  getObservedAppState,
  isElementInGroup,
  isBindingElement,
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
  makeNextSelectedElementIds,
  normalizeSVG,
  syncInvalidIndices,
  updateBoundElements,
} from "@excalidraw/element";

import {
  dataURLToString,
  getDataURL_sync,
} from "@excalidraw/excalidraw/data/blob";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import { KEYS, isArrowKey } from "@excalidraw/common";

import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { Fonts } from "@excalidraw/excalidraw/fonts";
import { LassoTrail } from "@excalidraw/excalidraw/lasso";
import { AppViewport } from "@excalidraw/excalidraw/components/App.viewport";
import { History } from "@excalidraw/excalidraw/history";
import {
  getScrollToContentState,
  getViewportForZoomWithScrollConstraints,
} from "@excalidraw/excalidraw/viewport";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";
import { Renderer } from "@excalidraw/excalidraw/scene/Renderer";
import rough from "roughjs/bin/rough";

import type { RoughCanvas } from "roughjs/bin/canvas";

import type { EditorInterface, IMAGE_MIME_TYPES } from "@excalidraw/common";
import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  FileId,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { Mutable, ValueOf } from "@excalidraw/common/utility-types";
import type { ElementUpdate } from "@excalidraw/element";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  SceneData,
  ToolType,
} from "@excalidraw/excalidraw/types";
import type { SetViewportOptions } from "@excalidraw/excalidraw/viewport";
import type { ActionResult } from "@excalidraw/excalidraw/actions/types";

import {
  actionBindText,
  actionUnbindText,
  actionWrapTextInContainer,
} from "./actions/actionBoundText";
import { canvasActions } from "./actions/actionCanvas";
import { actionDeleteSelected } from "./actions/actionDeleteSelected";
import { actionDeselect } from "./actions/actionDeselect";
import {
  actionToggleElementLock,
  actionUnlockAllElements,
} from "./actions/actionElementLock";
import {
  actionDecreaseFontSize,
  actionIncreaseFontSize,
} from "./actions/actionFontSize";
import { actionToggleLinearEditor } from "./actions/actionLinearEditor";
import { actionTextAutoResize } from "./actions/actionTextAutoResize";
import { actionDuplicateSelection } from "./actions/actionDuplicateSelection";
import { TOGGLE_TOOLS, actionFinalize } from "./actions/actionFinalize";
import {
  handleAppOnDrop,
  pasteFromClipboard as pasteFromClipboardIntoEditor,
  trackPlainPasteKeyDown,
} from "./clipboard-interaction";
import {
  addNewImagesToImageCache,
  createScheduleImageRefresh,
  onImageToolbarButtonClick,
} from "./image-interaction";
import { renderEditor } from "./render";
import { actionFlipHorizontal, actionFlipVertical } from "./actions/actionFlip";
import { actionGroup, actionUngroup } from "./actions/actionGroup";
import { createRedoAction, createUndoAction } from "./actions/actionHistory";
import { actionSelectAll } from "./actions/actionSelectAll";
import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "./actions/actionZindex";
import {
  actionChangeBackgroundColor,
  actionChangeFillStyle,
  actionChangeFontFamily,
  actionChangeFontSize,
  actionChangeOpacity,
  actionChangeRoundness,
  actionChangeSloppiness,
  actionChangeStrokeColor,
  actionChangeStrokeStyle,
  actionChangeStrokeWidth,
  actionChangeTextAlign,
  actionChangeVerticalAlign,
} from "./actions/actionProperties";
import { ActionManager } from "./actions/manager";
import { CaliburnContextMenuComponent } from "./panel/context-menu.component";
import { CaliburnShapeActionsComponent } from "./panel/shape-actions.component";
import { handleCanvasContextMenu } from "./context-menu-interaction";
import { actionCopy, actionCut, actionPaste } from "./actions/actionClipboard";

import { createTestHook } from "./test-hook";
import {
  createGenericElementOnPointerDown,
  finalizeNewElementOnPointerUp,
  maybeDragNewElement,
} from "./create-interaction";
import {
  finalizeLinearOnPointerUp,
  handleLinearElementOnPointerDown,
  handleMultiElementPointerMove,
  maybeDragLinearPoint,
  maybeSuggestBindingOnHover,
} from "./linear-interaction";
import { cleanupAfterDragOnPointerUp } from "./drag-interaction";
import {
  maybeUpdateFrameToHighlightOnPointerMove,
  updateFrameMembershipOnPointerUp,
  updateFrameToHighlight,
} from "./frame-interaction";
import {
  finalizeFreeDrawOnPointerUp,
  handleFreeDrawElementOnPointerDown,
  maybeDragFreeDrawElement,
} from "./freedraw-interaction";
import { getEffectiveGridSize } from "./create-interaction";
import {
  gesture,
  handleCanvasPanUsingWheelOrSpaceDrag as panCanvasOnWheelOrSpaceDrag,
  isGestureActive,
  removePointer,
  resetGesture,
  updateGestureOnPointerDown,
  updateMultiTouchGesture,
} from "./pan-gesture";
import {
  handleCanvasDoubleClick,
  handleEnterToEditKeyDown,
  handleTextElementOnPointerUp,
  handleTextOnPointerDown,
  maybeStartTextEditingOnPointerUp,
} from "./text-interaction";
import {
  handleLassoPointerDown,
  handleSelectionPointerDown,
  handleSelectionPointerMove,
  handleSelectionPointerUp,
  initialPointerDownState,
  updateActiveLockedIdOnPointerUp,
} from "./selection-interaction";

import type { ElementRef } from "@angular/core";

import type { PointerDownState } from "./selection-interaction";

import type { AfterViewInit, OnDestroy, OnInit } from "@angular/core";

type SetStateArg =
  | Partial<AppState>
  | ((prevState: AppState) => Partial<AppState> | null)
  | null;

export const TOOLBAR_TOOLS = Object.values(TOOL_TYPE);

/**
 * The editor shell the harness mounts. It carries the real element engine
 * (Scene, Store, History) and the upstream AppState shape; the editor
 * behavior itself arrives slice by slice, replacing pieces of this stub.
 */
@Component({
  selector: "caliburn-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnContextMenuComponent, CaliburnShapeActionsComponent],
  template: `
    <div
      #container
      class="excalidraw excalidraw-container"
      tabindex="0"
      (drop)="handleAppOnDrop($event)"
      (dragover)="handleAppOnDragOver($event)"
    >
      <div class="App-toolbar">
        @for (tool of toolbarTools; track tool) {
        <button
          type="button"
          [attr.data-testid]="'toolbar-' + tool"
          [attr.aria-label]="tool"
          (click)="setActiveTool({ type: tool })"
        >
          {{ tool }}
        </button>
        }
        <button
          type="button"
          data-testid="toolbar-lock"
          aria-label="lock"
          (click)="toggleToolLock()"
        >
          lock
        </button>
      </div>
      <canvas #staticCanvas class="excalidraw__canvas static"></canvas>
      <canvas
        #newElementCanvas
        class="excalidraw__canvas"
        style="display: none"
      ></canvas>
      <canvas
        #interactiveCanvas
        class="excalidraw__canvas interactive"
        (pointerdown)="handleCanvasPointerDown($event)"
        (pointermove)="handleCanvasPointerMove($event)"
        (pointerup)="handleCanvasPointerUp($event)"
        (dblclick)="handleCanvasDoubleClick($event)"
        (contextmenu)="handleCanvasContextMenu($event)"
        (wheel)="handleWheel($event)"
      ></canvas>
      <div class="SVGLayer">
        <svg #svgLayer></svg>
      </div>
      <div class="excalidraw-textEditorContainer"></div>
      <caliburn-shape-actions />
      <caliburn-context-menu />
    </div>
  `,
})
export class CaliburnEditorComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  readonly handleKeyboardGlobally = input(false);
  readonly autoFocus = input(false);
  readonly imageOptions = input<{
    maxWidthOrHeight?: number;
    maxFileSizeBytes?: number;
  } | null>(null);
  readonly initialData = input<{
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    scrollToContent?: boolean;
  } | null>(null);
  readonly initialState = input<{
    viewport?: Omit<SetViewportOptions, "animation">;
  } | null>(null);

  readonly containerRef = viewChild<ElementRef<HTMLDivElement>>("container");
  readonly staticCanvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("staticCanvas");
  readonly svgLayerRef = viewChild<ElementRef<SVGSVGElement>>("svgLayer");
  readonly newElementCanvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("newElementCanvas");
  readonly interactiveCanvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("interactiveCanvas");

  readonly toolbarTools = TOOLBAR_TOOLS;

  /**
   * Bumped on every commit so child views (the panels) that read it are
   * marked dirty and refresh in the same synchronous change-detection pass.
   */
  readonly changeGeneration = signal(0);

  get canvas(): HTMLCanvasElement {
    return this.staticCanvasRef()!.nativeElement;
  }

  rc: RoughCanvas | null = null;

  embedsValidationStatus: Map<ExcalidrawElement["id"], boolean> = new Map();

  elementsPendingErasure: Set<ExcalidrawElement["id"]> = new Set();

  private scheduleImageRefresh = createScheduleImageRefresh(this);

  renderInteractiveSceneCallback = () => {
    this.scheduleImageRefresh();
  };

  state: AppState = {
    ...getDefaultAppState(),
    offsetLeft: 0,
    offsetTop: 0,
    width: 0,
    height: 0,
  };

  readonly scene = new Scene();
  readonly renderer = new Renderer(this.scene);
  readonly store = new Store(this as any);
  readonly history = new History(this.store);
  readonly fonts = new Fonts(this.scene);
  readonly lassoTrail = new LassoTrail(this as any);

  visibleElements: readonly NonDeletedExcalidrawElement[] = [];

  readonly editorInterface: EditorInterface = {
    formFactor: "desktop",
    desktopUIMode: "full",
    userAgent: { isMobileDevice: false, platform: "other" },
    isTouchScreen: false,
    canFitSidebar: true,
    isLandscape: true,
  };

  unmounted = false;

  readonly viewport = new AppViewport(this as any, {
    getContainer: () => this.containerRef()?.nativeElement ?? null,
    getStylesPanelMode: () => "full",
    isGestureActive,
  });

  readonly props = {
    UIOptions: DEFAULT_UI_OPTIONS,
    onDuplicate: undefined as unknown,
    imageOptions: { ...DEFAULT_IMAGE_OPTIONS },
  };

  imageCache: Map<
    FileId,
    {
      image: HTMLImageElement | Promise<HTMLImageElement>;
      mimeType: ValueOf<typeof IMAGE_MIME_TYPES>;
    }
  > = new Map();

  lastPointerDownEvent: PointerEvent | null = null;

  readonly flowchart = { isCreatingChart: false };

  files: BinaryFiles = {};

  textWysiwygSubmitHandler: (() => void) | null = null;

  readonly cursor = {
    reset: () => {},
    set: (_cursorType?: string) => {},
    applyForTool: () => {},
  };

  lastCompletedCanvasClicks: { x: number; y: number }[] = [];

  lastPointerUpIsDoubleClick = false;

  readonly onChangeEmitter = new Emitter<
    [
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ]
  >();

  readonly onScrollChangeEmitter = new Emitter<
    [scrollX: number, scrollY: number, zoom: AppState["zoom"]]
  >();

  readonly drawShape = {
    hasPendingGesture: () => false,
    finalize: () => {},
  };

  isInteractionEnabled() {
    return true;
  }

  isNavigationEnabled() {
    return true;
  }

  syncActionResult = (actionResult: ActionResult) => {
    if (this.unmounted || actionResult === false) {
      return;
    }

    this.store.scheduleAction(actionResult.captureUpdate);

    let didUpdate = false;

    if (actionResult.elements) {
      this.scene.replaceAllElements(actionResult.elements);
      didUpdate = true;
    }

    if (actionResult.files) {
      this.addMissingFiles(actionResult.files, actionResult.replaceFiles);
      addNewImagesToImageCache(this);
    }

    if (actionResult.appState || this.state.contextMenu) {
      this.setState((prevAppState) => ({
        ...prevAppState,
        ...(actionResult.appState || {}),
        contextMenu: null,
      }));
      didUpdate = true;
    }

    if (!didUpdate) {
      this.scene.triggerUpdate();
    }
  };

  readonly actionManager = new ActionManager(
    this.syncActionResult,
    () => this.state,
    () => this.scene.getElementsIncludingDeleted(),
    this,
  );

  private readonly cdr = inject(ChangeDetectorRef);
  private removeSceneUpdateListener: (() => void) | null = null;
  private pointerDownState: PointerDownState | null = null;

  constructor() {
    this.actionManager.registerAll([
      ...canvasActions,
      actionDeselect,
      actionFinalize,
      actionSelectAll,
      actionDeleteSelected,
      actionDuplicateSelection,
      actionFlipHorizontal,
      actionFlipVertical,
      actionGroup,
      actionUngroup,
      actionSendBackward,
      actionBringForward,
      actionSendToBack,
      actionBringToFront,
      actionBindText,
      actionUnbindText,
      actionWrapTextInContainer,
      actionTextAutoResize,
      actionToggleElementLock,
      actionToggleLinearEditor,
      actionUnlockAllElements,
      actionDecreaseFontSize,
      actionIncreaseFontSize,
      actionChangeStrokeColor,
      actionChangeBackgroundColor,
      actionChangeFillStyle,
      actionChangeStrokeWidth,
      actionChangeSloppiness,
      actionChangeStrokeStyle,
      actionChangeOpacity,
      actionChangeFontSize,
      actionChangeFontFamily,
      actionChangeTextAlign,
      actionChangeVerticalAlign,
      actionChangeRoundness,
      actionCopy,
      actionCut,
      actionPaste,
      createUndoAction(this.history),
      createRedoAction(this.history),
    ]);
    const hook = createTestHook();
    Object.defineProperties(hook, {
      state: {
        configurable: true,
        get: () => this.state,
      },
      setState: {
        configurable: true,
        value: (...args: Parameters<CaliburnEditorComponent["setState"]>) => {
          return this.setState(...args);
        },
      },
      app: {
        configurable: true,
        value: this,
      },
      history: {
        configurable: true,
        get: () => this.history,
      },
      store: {
        configurable: true,
        get: () => this.store,
      },
    });
  }

  ngOnInit() {
    const imageOptions = this.imageOptions();
    this.props.imageOptions = {
      maxWidthOrHeight:
        imageOptions?.maxWidthOrHeight ??
        DEFAULT_IMAGE_OPTIONS.maxWidthOrHeight,
      maxFileSizeBytes:
        imageOptions?.maxFileSizeBytes ??
        DEFAULT_IMAGE_OPTIONS.maxFileSizeBytes,
    };

    this.store.onDurableIncrementEmitter.on((increment) => {
      this.history.record(increment.delta);
    });
    this.removeSceneUpdateListener = this.scene.onUpdate(() => {
      this.commit();
      this.cdr.detectChanges();
    });

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("paste", this.pasteFromClipboard);
    document.addEventListener("copy", this.onCopy);
    document.addEventListener("cut", this.onCut);
    window.addEventListener("resize", this.onWindowResize);

    this.commit();
  }

  private onWindowResize = () => {
    this.updateDOMRect();
  };

  ngAfterViewInit() {
    const staticCanvas = this.staticCanvasRef()?.nativeElement;
    if (staticCanvas) {
      this.rc = rough.canvas(staticCanvas);
    }
    const svgLayer = this.svgLayerRef()?.nativeElement;
    if (svgLayer) {
      this.lassoTrail.start(svgLayer);
    }
    this.updateDOMRect();
    this.initializeScene();
    if (this.autoFocus()) {
      this.focusContainer();
    }
    renderEditor(this);
  }

  ngOnDestroy() {
    this.unmounted = true;
    this.lassoTrail.stop();
    resetGesture();
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("paste", this.pasteFromClipboard);
    document.removeEventListener("copy", this.onCopy);
    document.removeEventListener("cut", this.onCut);
    window.removeEventListener("resize", this.onWindowResize);
    this.removeSceneUpdateListener?.();
    this.removeSceneUpdateListener = null;
    this.store.onStoreIncrementEmitter.clear();
    this.history.clear();
    this.store.clear();
    this.scene.destroy();
  }

  private initializeScene() {
    const initialData = this.initialData();

    const restoredElements = restoreElements(initialData?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    });
    let restoredAppState: Partial<AppState> = {
      ...this.state,
      ...(initialData?.appState || {}),
    };

    const viewportAppState = {
      ...this.state,
      ...restoredAppState,
    } as AppState;
    const initialViewport = this.initialState()?.viewport;

    if (initialViewport) {
      const restoredNonDeletedElements = restoredElements.filter(
        (element) => !element.isDeleted,
      );
      const initialViewportState = this.viewport.resolveInitialViewport(
        initialViewport,
        arrayToMap(restoredNonDeletedElements) as Parameters<
          AppViewport["resolveInitialViewport"]
        >[1],
        viewportAppState,
      );
      if (initialViewportState) {
        restoredAppState = {
          ...restoredAppState,
          ...initialViewportState,
        };
      }
    } else if (initialData?.scrollToContent) {
      restoredAppState = {
        ...restoredAppState,
        ...getScrollToContentState(restoredElements, viewportAppState),
      };
    }

    this.store.clear();
    this.history.clear();
    this.syncActionResult({
      elements: restoredElements,
      appState: restoredAppState as AppState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    // manually loading the font faces seems faster even in browsers that do
    // fire the loadingdone event
    this.fonts.loadSceneFonts().then((fontFaces) => {
      this.fonts.onLoaded(fontFaces);
    });
  }

  private updateDOMRect() {
    const container = this.containerRef()?.nativeElement;
    if (!container) {
      return;
    }
    const {
      width,
      height,
      left: offsetLeft,
      top: offsetTop,
    } = container.getBoundingClientRect();
    const {
      width: currentWidth,
      height: currentHeight,
      offsetTop: currentOffsetTop,
      offsetLeft: currentOffsetLeft,
    } = this.state;

    if (
      width === currentWidth &&
      height === currentHeight &&
      offsetLeft === currentOffsetLeft &&
      offsetTop === currentOffsetTop
    ) {
      return;
    }

    this.setState({ width, height, offsetLeft, offsetTop });
    // a smaller viewport may push the min zoom up / shrink the pan range
    this.viewport.constrain();
  }

  private onKeyDown = (event: KeyboardEvent) => {
    trackPlainPasteKeyDown(event);

    // bail if
    if (
      // inside an input
      (isWritableElement(event.target) &&
        // unless pressing escape (finalize action)
        event.key !== KEYS.ESCAPE) ||
      // or unless using arrows (to move between buttons)
      (isArrowKey(event.key) && isInputLike(event.target))
    ) {
      return;
    }
    if (this.maybeHandlePageScrollKeyDown(event)) {
      // the editor consumes the input — the page must not scroll along
      event.preventDefault();
      return;
    }
    if (this.actionManager.handleKeyDown(event)) {
      return;
    }

    if (isArrowKey(event.key)) {
      let selectedElements = this.scene.getSelectedElements({
        selectedElementIds: this.state.selectedElementIds,
        includeBoundTextElement: true,
        includeElementsInFrames: true,
      });

      const arrowIdsToRemove = new Set<string>();

      selectedElements
        .filter((el): el is NonDeleted<ExcalidrawArrowElement> =>
          isBindingElement(el),
        )
        .filter((arrow) => {
          const startElementNotInSelection =
            arrow.startBinding &&
            !selectedElements.some(
              (el) => el.id === arrow.startBinding?.elementId,
            );
          const endElementNotInSelection =
            arrow.endBinding &&
            !selectedElements.some(
              (el) => el.id === arrow.endBinding?.elementId,
            );
          return startElementNotInSelection || endElementNotInSelection;
        })
        .forEach((arrow) => arrowIdsToRemove.add(arrow.id));

      selectedElements = selectedElements.filter(
        (el) => !arrowIdsToRemove.has(el.id),
      );

      const step =
        (this.getEffectiveGridSize() &&
          (event.shiftKey
            ? ELEMENT_TRANSLATE_AMOUNT
            : this.getEffectiveGridSize())) ||
        (event.shiftKey
          ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
          : ELEMENT_TRANSLATE_AMOUNT);

      let offsetX = 0;
      let offsetY = 0;

      if (event.key === KEYS.ARROW_LEFT) {
        offsetX = -step;
      } else if (event.key === KEYS.ARROW_RIGHT) {
        offsetX = step;
      } else if (event.key === KEYS.ARROW_UP) {
        offsetY = -step;
      } else if (event.key === KEYS.ARROW_DOWN) {
        offsetY = step;
      }

      selectedElements.forEach((element) => {
        this.scene.mutateElement(
          element,
          {
            x: element.x + offsetX,
            y: element.y + offsetY,
          },
          { informMutation: false, isDragging: false },
        );

        updateBoundElements(element, this.scene, {
          simultaneouslyUpdated: selectedElements,
        });
      });

      this.scene.triggerUpdate();

      event.preventDefault();
    } else if (event.key === KEYS.ENTER) {
      handleEnterToEditKeyDown(this, event);
    }
  };

  handleWheel = (event: WheelEvent) => {
    // NOTE no preventDefault so the page can scroll over the editor
    if (!this.isNavigationEnabled()) {
      return;
    }
    if (
      !(
        event.target instanceof HTMLCanvasElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLIFrameElement
      )
    ) {
      // prevent zooming the browser (but allow scrolling DOM)
      if (event[KEYS.CTRL_OR_CMD]) {
        event.preventDefault();
      }

      return;
    }

    event.preventDefault();

    const { deltaX, deltaY } = event;
    // note that event.ctrlKey is necessary to handle pinch zooming
    if (event.metaKey || event.ctrlKey) {
      const sign = Math.sign(deltaY);
      const MAX_STEP = ZOOM_STEP * 100;
      const absDelta = Math.abs(deltaY);
      let delta = deltaY;
      if (absDelta > MAX_STEP) {
        delta = MAX_STEP * sign;
      }

      let newZoom = this.state.zoom.value - delta / 100;
      // increase zoom steps the more zoomed-in we are (applies to >100% only)
      newZoom +=
        Math.log10(Math.max(1, this.state.zoom.value)) *
        -sign *
        // reduced amplification for small deltas (small movements on a trackpad)
        Math.min(1, absDelta / 20);

      const minZoom = this.state.scrollConstraints?.lockZoom
        ? this.state.scrollConstraints.zoom
        : MIN_ZOOM;
      newZoom = Math.max(newZoom, minZoom);

      const didTranslate = this.viewport.translate(
        (state) => ({
          ...getViewportForZoomWithScrollConstraints(
            {
              viewportX: this.viewport.lastPosition.x,
              viewportY: this.viewport.lastPosition.y,
              nextZoom: getNormalizedZoom(newZoom),
            },
            state,
          ),
          shouldCacheIgnoreZoom: true,
        }),
        {
          zoomPreConstrained: true,
          preserveScrollConstraintsSnapBack: true,
        },
      );
      if (didTranslate) {
        this.resetShouldCacheIgnoreZoomDebounced();
      }
      return;
    }

    // scroll horizontally when shift pressed
    if (event.shiftKey) {
      this.viewport.translate(({ zoom, scrollX }) => ({
        // on Mac, shift+wheel tends to result in deltaX
        scrollX: scrollX - (deltaY || deltaX) / zoom.value,
      }));
      return;
    }

    this.viewport.translate(({ zoom, scrollX, scrollY }) => ({
      scrollX: scrollX - deltaX / zoom.value,
      scrollY: scrollY - deltaY / zoom.value,
    }));
  };

  private resetShouldCacheIgnoreZoomDebounced = debounce(() => {
    if (!this.unmounted) {
      this.setState({ shouldCacheIgnoreZoom: false });
    }
  }, 300);

  /**
   * PageUp/PageDown scroll the canvas by a page — vertically, or
   * horizontally with shift. Respects `appState.scrollConstraints`
   * (via `viewport.translate`).
   */
  private maybeHandlePageScrollKeyDown = (event: KeyboardEvent): boolean => {
    if (event.key !== KEYS.PAGE_UP && event.key !== KEYS.PAGE_DOWN) {
      return false;
    }
    let offset =
      (event.shiftKey ? this.state.width : this.state.height) /
      this.state.zoom.value;
    if (event.key === KEYS.PAGE_DOWN) {
      offset = -offset;
    }
    if (event.shiftKey) {
      this.viewport.translate((state) => ({
        scrollX: state.scrollX + offset,
      }));
    } else {
      this.viewport.translate((state) => ({
        scrollY: state.scrollY + offset,
      }));
    }
    return true;
  };

  setState(state: SetStateArg, callback?: () => void) {
    const prevState = this.state;
    const partial = typeof state === "function" ? state(this.state) : state;
    if (partial) {
      this.state = { ...this.state, ...partial };
    }
    this.commit();
    if (
      prevState.scrollX !== this.state.scrollX ||
      prevState.scrollY !== this.state.scrollY ||
      prevState.zoom !== this.state.zoom
    ) {
      this.onScrollChangeEmitter.trigger(
        this.state.scrollX,
        this.state.scrollY,
        this.state.zoom,
      );
    }
    this.cdr.detectChanges();
    callback?.();
  }

  getSceneElements() {
    return this.scene.getNonDeletedElements();
  }

  getSceneElementsIncludingDeleted() {
    return this.scene.getElementsIncludingDeleted();
  }

  getSceneElementsMapIncludingDeleted() {
    return this.scene.getElementsMapIncludingDeleted();
  }

  isToolSupported = <T extends ToolType | "custom">(tool: T): boolean => {
    const tools = this.props.UIOptions as { tools?: Record<string, boolean> };
    if (tools.tools?.[tool] === false) {
      return false;
    }
    return this.isInteractionEnabled();
  };

  setActiveTool = (
    tool: ({ type: ToolType } | { type: "custom"; customType: string }) & {
      locked?: boolean;
      fromSelection?: boolean;
    },
    opts: {
      keepSelection?: boolean;
      /**
       * When `true`, re-activating an already-active toggle tool (see
       * `TOGGLE_TOOLS`) switches back to the previously active tool.
       * Activation is idempotent by default; toggle tools always record the
       * previously active tool regardless (so ESC and the next `toggle`
       * activation can switch back to it).
       */
      toggle?: boolean;
    } = {},
  ) => {
    const { keepSelection = false } = opts;

    if (!this.isToolSupported(tool.type)) {
      console.warn(
        this.isInteractionEnabled()
          ? `"${tool.type}" tool is disabled via "UIOptions.canvasActions.tools.${tool.type}"`
          : `"${tool.type}" tool cannot be activated while the editor is non-interactive (see "interaction.enabled.tools")`,
      );
      return;
    }

    if (this.drawShape.hasPendingGesture()) {
      // switching tools mid-sketch (e.g. paste resets to the selection tool)
      // must not strand the gesture — commit it through the finalize funnel
      // while the drawShape tool is still active
      this.actionManager.executeAction(actionFinalize);
    }

    const isToggleTool = TOGGLE_TOOLS.includes(tool.type);
    const toggle = opts.toggle === true && isToggleTool;

    const nextActiveTool =
      toggle && this.state.activeTool.type === tool.type
        ? // toggle back to the tool that was active before this one
          updateActiveTool(this.state, {
            ...(this.state.activeTool.lastActiveTool || {
              type: this.state.preferredSelectionTool.type,
            }),
            lastActiveTool: null,
          })
        : isToggleTool && this.state.activeTool.type !== tool.type
        ? // activating a toggle tool records the currently active tool so
          // ESC and the next `toggle` activation can switch back to it
          updateActiveTool(this.state, {
            ...tool,
            lastActiveTool: this.state.activeTool,
          })
        : updateActiveTool(this.state, tool);

    if (nextActiveTool.type === "image") {
      onImageToolbarButtonClick(this);
    }

    this.setState((prevState) => {
      const commonResets = {
        snapLines: prevState.snapLines.length ? [] : prevState.snapLines,
        originSnapOffset: null,
        activeEmbeddable: null,
        selectedLinearElement: isSelectionLikeTool(nextActiveTool.type)
          ? prevState.selectedLinearElement
          : null,
        frameToHighlight: null,
        // only the text tool offers arrow-endpoint binding, and the highlight
        // is refreshed on pointermove — don't leave a stale one behind
        hoveredArrowTextAnchor: null,
      } as const;

      if (nextActiveTool.type === "freedraw") {
        this.store.scheduleCapture();
      }

      if (nextActiveTool.type === "lasso") {
        return {
          ...prevState,
          ...commonResets,
          activeTool: nextActiveTool,
          ...(keepSelection
            ? {}
            : {
                selectedElementIds: makeNextSelectedElementIds({}, prevState),
                selectedGroupIds: makeNextSelectedElementIds({}, prevState),
                editingGroupId: null,
                multiElement: null,
              }),
        };
      } else if (nextActiveTool.type !== "selection") {
        return {
          ...prevState,
          ...commonResets,
          activeTool: nextActiveTool,
          selectedElementIds: makeNextSelectedElementIds({}, prevState),
          selectedGroupIds: makeNextSelectedElementIds({}, prevState),
          editingGroupId: null,
          multiElement: null,
        };
      }
      return {
        ...prevState,
        ...commonResets,
        activeTool: nextActiveTool,
      };
    });
  };

  toggleToolLock() {
    this.setState({
      activeTool: {
        ...this.state.activeTool,
        locked: !this.state.activeTool.locked,
      },
    });
  }

  clearSelection(hitElement?: ExcalidrawElement | null) {
    this.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds({}, prevState),
      activeEmbeddable: null,
      selectedGroupIds: {},
      // Continue editing the same group if the user selected a different
      // element from it
      editingGroupId:
        prevState.editingGroupId &&
        hitElement != null &&
        isElementInGroup(hitElement, prevState.editingGroupId)
          ? prevState.editingGroupId
          : null,
    }));
    this.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.state),
      activeEmbeddable: null,
      previousSelectedElementIds: this.state.selectedElementIds,
      selectedLinearElement: null,
    });
  }

  mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
    element: TElement,
    updates: ElementUpdate<TElement>,
    informMutation = true,
  ) => {
    return this.scene.mutateElement(element, updates, {
      informMutation,
      isDragging: false,
    });
  };

  updateScene = <K extends keyof AppState>(sceneData: {
    elements?: SceneData["elements"];
    appState?: Pick<AppState, K> | null;
    collaborators?: SceneData["collaborators"];
    captureUpdate?: SceneData["captureUpdate"];
  }) => {
    const { elements, appState, collaborators, captureUpdate } = sceneData;

    if (captureUpdate) {
      const nextElements = elements ? elements : undefined;
      const observedAppState = appState
        ? getObservedAppState({
            ...this.store.snapshot.appState,
            ...appState,
          })
        : undefined;

      this.store.scheduleMicroAction({
        action: captureUpdate,
        elements: nextElements,
        appState: observedAppState,
      });
    }

    if (appState) {
      this.setState(appState);
    }

    if (elements) {
      this.scene.replaceAllElements(elements);
    }

    if (collaborators) {
      this.setState({ collaborators });
    }
  };

  handleCanvasPanUsingWheelOrSpaceDrag = (event: PointerEvent | MouseEvent) =>
    panCanvasOnWheelOrSpaceDrag(this, event as PointerEvent);

  handleCanvasDoubleClick(event: MouseEvent) {
    handleCanvasDoubleClick(this, event);
  }

  handleCanvasContextMenu(event: MouseEvent) {
    handleCanvasContextMenu(this, event);
  }

  private onCut = (event: ClipboardEvent) => {
    if (!this.isInteractionEnabled()) {
      return;
    }
    const isExcalidrawActive = this.containerRef()?.nativeElement?.contains(
      document.activeElement,
    );
    if (!isExcalidrawActive || isWritableElement(event.target)) {
      return;
    }
    this.actionManager.executeAction(actionCut, "keyboard", event);
    event.preventDefault();
    event.stopPropagation();
  };

  private onCopy = (event: ClipboardEvent) => {
    if (!this.isInteractionEnabled()) {
      return;
    }
    const isExcalidrawActive = this.containerRef()?.nativeElement?.contains(
      document.activeElement,
    );
    if (!isExcalidrawActive || isWritableElement(event.target)) {
      return;
    }
    this.actionManager.executeAction(actionCopy, "keyboard", event);
    event.preventDefault();
    event.stopPropagation();
  };

  handleCanvasPointerDown(event: PointerEvent) {
    this.lastPointerDownEvent = event;

    // since contextMenu options are potentially evaluated on each render,
    // and an contextMenu action may depend on selection state, we must
    // close the contextMenu before we update the selection on pointerDown
    // (e.g. resetting selection)
    if (this.state.contextMenu) {
      this.setState({ contextMenu: null });
    }

    if (this.handleCanvasPanUsingWheelOrSpaceDrag(event)) {
      return;
    }

    updateGestureOnPointerDown(this, event);

    // only handle left mouse button or touch
    if (
      event.button !== POINTER_BUTTON.MAIN &&
      event.button !== POINTER_BUTTON.TOUCH
    ) {
      return;
    }

    // don't select while panning
    if (gesture.pointers.size > 1) {
      if (this.state.selectionElement) {
        this.setState({ selectionElement: null });
      }
      this.pointerDownState = null;
      return;
    }

    const activeToolType = this.state.activeTool.type;
    if (activeToolType === "selection" || activeToolType === "lasso") {
      this.pointerDownState = handleSelectionPointerDown(this, event);
      if (this.state.activeTool.type === "lasso") {
        handleLassoPointerDown(this, event, this.pointerDownState);
      }
    } else if (
      activeToolType === "rectangle" ||
      activeToolType === "diamond" ||
      activeToolType === "ellipse" ||
      activeToolType === "embeddable"
    ) {
      this.pointerDownState = initialPointerDownState(this, event);
      createGenericElementOnPointerDown(
        this,
        activeToolType,
        this.pointerDownState,
      );
    } else if (activeToolType === "arrow" || activeToolType === "line") {
      this.pointerDownState = initialPointerDownState(this, event);
      handleLinearElementOnPointerDown(
        this,
        event,
        activeToolType,
        this.pointerDownState,
      );
    } else if (activeToolType === "freedraw") {
      this.pointerDownState = initialPointerDownState(this, event);
      handleFreeDrawElementOnPointerDown(
        this,
        event,
        activeToolType,
        this.pointerDownState,
      );
    } else if (activeToolType === "text") {
      this.pointerDownState = initialPointerDownState(this, event);
      handleTextOnPointerDown(this, event, this.pointerDownState);
    }
  }

  handleCanvasPointerMove(event: PointerEvent) {
    this.viewport.lastPosition.x = event.clientX;
    this.viewport.lastPosition.y = event.clientY;

    updateMultiTouchGesture(this, event);

    if (gesture.pointers.size >= 2) {
      return;
    }

    if (this.pointerDownState) {
      const coords = viewportCoordsToSceneCoords(event, this.state);
      this.pointerDownState.lastCoords = coords;
      if (maybeDragFreeDrawElement(this, this.pointerDownState, event)) {
        return;
      }
      if (maybeDragLinearPoint(this, this.pointerDownState, event)) {
        return;
      }
      if (this.state.newElement) {
        this.pointerDownState.drag.hasOccurred = true;
        maybeDragNewElement(this, this.pointerDownState, event);
      } else {
        handleSelectionPointerMove(this, this.pointerDownState, event);
      }
      return;
    }

    handleMultiElementPointerMove(this, event);
    maybeSuggestBindingOnHover(this, event);
    maybeUpdateFrameToHighlightOnPointerMove(
      this,
      viewportCoordsToSceneCoords(event, this.state),
    );
  }

  handleCanvasPointerUp(event: PointerEvent) {
    removePointer(this, event);
    if (this.pointerDownState) {
      if (this.state.newElement?.type === "freedraw") {
        finalizeFreeDrawOnPointerUp(this, event);
      } else if (isLinearElement(this.state.newElement)) {
        finalizeLinearOnPointerUp(this, this.pointerDownState, event);
      } else if (isTextElement(this.state.newElement)) {
        handleTextElementOnPointerUp(this, this.state.newElement);
      } else if (this.state.newElement) {
        finalizeNewElementOnPointerUp(this, this.pointerDownState);
      } else {
        handleSelectionPointerUp(this, this.pointerDownState);
        updateActiveLockedIdOnPointerUp(this, this.pointerDownState, event);
        updateFrameMembershipOnPointerUp(this, this.pointerDownState, event);
        if (
          maybeStartTextEditingOnPointerUp(this, this.pointerDownState, event)
        ) {
          this.clearHighlightsOnPointerUp();
          this.pointerDownState = null;
          return;
        }
        cleanupAfterDragOnPointerUp(this, this.pointerDownState);
      }
      this.clearHighlightsOnPointerUp();
      this.pointerDownState = null;
    }
  }

  private clearHighlightsOnPointerUp() {
    if (this.state.frameToHighlight || this.state.elementsToHighlight) {
      this.setState({ frameToHighlight: null, elementsToHighlight: null });
    }
  }

  focusContainer = () => {
    this.containerRef()?.nativeElement?.focus();
  };

  pasteFromClipboard = (event: ClipboardEvent) => {
    pasteFromClipboardIntoEditor(this, event);
  };

  handleAppOnDrop = (event: DragEvent) => {
    handleAppOnDrop(this, event);
  };

  handleAppOnDragOver = (event: DragEvent) => {
    event.preventDefault();
  };

  addMissingFiles = (
    files: BinaryFiles | BinaryFileData[],
    replace = false,
  ) => {
    const nextFiles = replace ? {} : { ...this.files };
    const addedFiles: BinaryFiles = {};

    const _files = Array.isArray(files) ? files : Object.values(files);

    for (const fileData of _files) {
      if (nextFiles[fileData.id]) {
        continue;
      }

      addedFiles[fileData.id] = fileData;
      nextFiles[fileData.id] = fileData;

      if (fileData.mimeType === MIME_TYPES.svg) {
        try {
          const restoredDataURL = getDataURL_sync(
            normalizeSVG(dataURLToString(fileData.dataURL)),
            MIME_TYPES.svg,
          );
          if (fileData.dataURL !== restoredDataURL) {
            // bump version so persistence layer can update the store
            fileData.version = (fileData.version ?? 1) + 1;
            fileData.dataURL = restoredDataURL;
          }
        } catch (error) {
          console.error(error);
        }
      }
    }

    this.files = nextFiles;

    return { addedFiles };
  };

  getEffectiveGridSize() {
    return getEffectiveGridSize(this);
  }

  insertNewElements = (elements: readonly ExcalidrawElement[]) => {
    if (!elements.length) {
      return;
    }

    const chunkedElements: ExcalidrawElement[][] = [];

    for (const element of elements) {
      const currentChunk = chunkedElements[chunkedElements.length - 1];

      if (currentChunk?.[0].frameId === element.frameId) {
        currentChunk.push(element);
      } else {
        chunkedElements.push([element]);
      }
    }

    for (const chunk of chunkedElements) {
      const frameId = chunk[0].frameId;

      const insertionIndex = frameId
        ? getFrameChildrenInsertionIndex(
            this.scene.getElementsIncludingDeleted(),
            frameId,
          )
        : null;
      this.scene.insertElementsAtIndex(chunk, insertionIndex);
    }
  };

  insertNewElement = (element: ExcalidrawElement) => {
    this.insertNewElements([element]);

    const frame = element.frameId
      ? this.scene.getNonDeletedElement(element.frameId)
      : null;

    updateFrameToHighlight(
      this,
      frame && isFrameLikeElement(frame) ? frame : null,
    );
  };

  isToolLocked(): boolean {
    return this.state.activeTool.locked;
  }

  getCurrentItemStrokeWidth(elementType: ExcalidrawElement["type"]) {
    return getStrokeWidthByKey(
      elementType,
      this.state.currentItemStrokeWidthKey,
    );
  }

  requestUnfollow() {}

  refreshEditorInterface() {}

  refresh() {}

  private commit() {
    this.changeGeneration.update((generation) => generation + 1);
    this.store.commit(this.scene.getElementsMapIncludingDeleted(), this.state);
    this.onChangeEmitter.trigger(
      this.scene.getElementsIncludingDeleted(),
      this.state,
      this.files,
    );
    if (!this.unmounted) {
      renderEditor(this);
    }
  }
}
