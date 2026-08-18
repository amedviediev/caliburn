import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

import {
  AppEventBus,
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_UI_OPTIONS,
  EVENT,
  THEME,
  TOOL_TYPE,
  addEventListener,
  arrayToMap,
  getDateTime,
  muteFSAbortError,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  Emitter,
  MIME_TYPES,
  MIN_ZOOM,
  MQ_RIGHT_SIDEBAR_MIN_WIDTH,
  POINTER_BUTTON,
  POINTER_EVENTS,
  TAP_TWICE_TIMEOUT,
  ZOOM_STEP,
  createUserAgentDescriptor,
  debounce,
  deriveStylesPanelMode,
  getFeatureFlag,
  getFormFactor,
  getStrokeWidthByKey,
  isBrave,
  isInputLike,
  isSelectionLikeTool,
  isToolIcon,
  isWritableElement,
  loadDesktopUIModePreference,
  supportsResizeObserver,
  updateActiveTool,
  updateObject,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  LinearElementEditor,
  Scene,
  ShapeCache,
  Store,
  StoreDelta,
  bindOrUnbindBindingElements,
  calculateFixedPointForNonElbowArrowBinding,
  embeddableURLValidator,
  getActiveTextElement,
  getCommonBounds,
  getCursorForResizingElement,
  getElementWithTransformHandleType,
  getFrameChildrenInsertionIndex,
  getHoveredElementForBinding,
  getBoundTextElement,
  getObservedAppState,
  getTransformHandleTypeFromCoords,
  hasBackground,
  isElementCompletelyInViewport,
  isElementInGroup,
  isArrowElement,
  isBindingElement,
  isBindingEnabled,
  isElbowArrow,
  isEmbeddableElement,
  isFrameLikeElement,
  isIframeElement,
  isImageElement,
  isInitializedImageElement,
  isLinearElement,
  isLinearElementType,
  isMeasureTextSupported,
  isSimpleArrow,
  isTextElement,
  makeNextSelectedElementIds,
  maybeHandleArrowPointlikeDrag,
  newElementWith,
  normalizeSVG,
  syncInvalidIndices,
  updateBoundElements,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import {
  dataURLToString,
  getDataURL_sync,
  isImageFileHandle,
} from "@excalidraw/excalidraw/data/blob";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import Library, { libraryItemsAtom } from "@excalidraw/excalidraw/data/library";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { exportCanvas } from "@excalidraw/excalidraw/data";
import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  ARROW_TYPE,
  CLASSES,
  CODES,
  CURSOR_TYPE,
  KEYS,
  isArrowKey,
} from "@excalidraw/common";

import { findShapeByKey } from "@excalidraw/excalidraw/components/Tools";

import {
  getDefaultAppState,
  isEraserActive,
  isHandToolActive,
} from "@excalidraw/excalidraw/appState";
import { Fonts } from "@excalidraw/excalidraw/fonts";
import { EraserTrail } from "@excalidraw/excalidraw/eraser";
import { LassoTrail } from "@excalidraw/excalidraw/lasso";
import { LaserTrails } from "@excalidraw/excalidraw/laserTrails";
import { AppCursor } from "@excalidraw/excalidraw/components/App.cursor";
import { AppStateObserver } from "@excalidraw/excalidraw/components/AppStateObserver";
import {
  AppViewport,
  RIGHT_SIDEBAR_WIDTH,
} from "@excalidraw/excalidraw/components/App.viewport";
import { History } from "@excalidraw/excalidraw/history";
import {
  getScrollToContentState,
  getViewportForZoomWithScrollConstraints,
} from "@excalidraw/excalidraw/viewport";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";
import { isPointHittingTextAutoResizeHandle } from "@excalidraw/excalidraw/textAutoResizeHandle";
import { Renderer } from "@excalidraw/excalidraw/scene/Renderer";
import rough from "roughjs/bin/rough";

import type {
  EditorInterface,
  EXPORT_IMAGE_TYPES,
  IMAGE_MIME_TYPES,
} from "@excalidraw/common";
import type { GlobalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawIframeElement,
  ExcalidrawIframeLikeElement,
  FileId,
  NonDeleted,
  NonDeletedExcalidrawElement,
  Ordered,
  OrderedExcalidrawElement,
  PointerType,
  Theme,
} from "@excalidraw/element/types";
import type { OnStateChange } from "@excalidraw/excalidraw/components/AppStateObserver";
import type { ExportedElements } from "@excalidraw/excalidraw/data";
import type { Mutable, ValueOf } from "@excalidraw/common/utility-types";
import type { ElementUpdate } from "@excalidraw/element";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  CollaboratorPointer,
  ElementsPendingErasure,
  EmbedsValidationStatus,
  FrameNameBoundsCache,
  Gesture,
  GestureEvent,
  InteractionConfig,
  LibraryItems,
  LibraryItemsSource,
  OnUserFollowedPayload,
  SceneData,
  UIConfig,
  UIOptions,
  SidebarName,
  SidebarTabName,
  ToolType,
  UnsubscribeCallback,
  UserToFollow,
} from "@excalidraw/excalidraw/types";
import type { SetViewportOptions } from "@excalidraw/excalidraw/viewport";
import type { RenderInteractiveSceneCallback } from "@excalidraw/excalidraw/scene/types";
import type { ApplyToOptions } from "@excalidraw/element";
import type { SceneElementsMap } from "@excalidraw/element/types";
import type {
  Action,
  ActionResult,
} from "@excalidraw/excalidraw/actions/types";

import { CaliburnArrowText } from "./arrow-text";
import { CaliburnBindMode } from "./bind-mode";
import { CaliburnBucketFill } from "./bucket-fill";
import { CaliburnDrawShape } from "./draw-shape";
import { CaliburnFlowchart } from "./flowchart";
import { CaliburnTouchInput } from "./touch-input";
import { actionAddToLibrary } from "./actions/actionAddToLibrary";
import {
  actionBindText,
  actionUnbindText,
  actionWrapTextInContainer,
} from "./actions/actionBoundText";
import { canvasActions } from "./actions/actionCanvas";
import { actionDeleteSelected } from "./actions/actionDeleteSelected";
import {
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
  actionExportWithDarkMode,
  actionLoadScene,
  actionSaveFileToDisk,
  actionSaveToActiveFile,
} from "./actions/actionExport";
import { actionShortcuts } from "./actions/actionMenu";
import { actionDeselect } from "./actions/actionDeselect";
import {
  actionToggleElementLock,
  actionUnlockAllElements,
} from "./actions/actionElementLock";
import {
  actionDecreaseFontSize,
  actionIncreaseFontSize,
} from "./actions/actionFontSize";
import {
  actionCopyElementLink,
  actionLinkToElement,
} from "./actions/actionElementLink";
import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionWrapSelectionInFrame,
  actionupdateFrameRendering,
} from "./actions/actionFrame";
import {
  actionToggleLinearEditor,
  actionTogglePolygon,
} from "./actions/actionLinearEditor";
import { actionGoToCollaborator } from "./actions/actionNavigate";
import { actionLink } from "./actions/actionLink";
import { actionCopyStyles, actionPasteStyles } from "./actions/actionStyles";
import { actionTextAutoResize } from "./actions/actionTextAutoResize";
import { actionToggleArrowBinding } from "./actions/actionToggleArrowBinding";
import { actionToggleGridMode } from "./actions/actionToggleGridMode";
import { actionToggleMidpointSnapping } from "./actions/actionToggleMidpointSnapping";
import { actionToggleObjectsSnapMode } from "./actions/actionToggleObjectsSnapMode";
import { actionToggleSearchMenu } from "./actions/actionToggleSearchMenu";
import { actionToggleStats } from "./actions/actionToggleStats";
import { actionToggleViewMode } from "./actions/actionToggleViewMode";
import { actionToggleZenMode } from "./actions/actionToggleZenMode";
import { actionDuplicateSelection } from "./actions/actionDuplicateSelection";
import { TOGGLE_TOOLS, actionFinalize } from "./actions/actionFinalize";
import {
  addElementsFromPasteOrLibrary,
  handleAppOnDrop,
  pasteFromClipboard as pasteFromClipboardIntoEditor,
  resetPlainPasteTracking,
  trackPlainPasteKeyDown,
} from "./clipboard-interaction";
import { clearLibraryItemSvgCache } from "./components/library/library-item-svg";
import {
  addNewImagesToImageCache,
  createScheduleImageRefresh,
  onImageToolbarButtonClick,
} from "./image-interaction";
import {
  handleIframeLikeCenterClick,
  handleIframeLikeElementHover,
  onWindowMessage,
} from "./embed-interaction";
import {
  applyElementLinkHoverAffordance,
  getElementLinkAtPosition,
  maybeHandleElementLinkClick,
} from "./link-interaction";
import { languageGenerationSignal, translated } from "./i18n";
import { renderEditor } from "./render";
import {
  actionAlignBottom,
  actionAlignHorizontallyCentered,
  actionAlignLeft,
  actionAlignRight,
  actionAlignTop,
  actionAlignVerticallyCentered,
} from "./actions/actionAlign";
import {
  distributeHorizontally,
  distributeVertically,
} from "./actions/actionDistribute";
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
  actionChangeArrowProperties,
  actionChangeArrowType,
  actionChangeArrowhead,
  actionChangeBackgroundColor,
  actionChangeBucketFillBackgroundColor,
  actionChangeFillStyle,
  actionChangeFontFamily,
  actionChangeFontSize,
  actionChangeFreedrawMode,
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
import {
  convertElementTypes,
  getConversionTypeFromElements,
} from "./components/convert-element-type";
import { CaliburnConvertElementTypePopupComponent } from "./components/convert-element-type-popup.component";
import { CaliburnCursorHintComponent } from "./components/cursor-hint.component";
import { CursorHints } from "./components/cursor-hints";
import {
  areElementCanvasButtonsHidden,
  CaliburnElementCanvasButtonsComponent,
} from "./components/element-canvas-buttons.component";
import { CaliburnEmbeddablesComponent } from "./components/embeddables.component";
import { CaliburnEyeDropperComponent } from "./components/eye-dropper.component";
import { CaliburnIconButtonComponent } from "./components/icon-button.component";
import { provideCaliburnIcons } from "./components/icons";
import { CaliburnFrameNameComponent } from "./components/frame-name.component";
import { CaliburnHyperlinkComponent } from "./components/hyperlink/hyperlink.component";
import { CaliburnLayerUIComponent } from "./components/layer-ui.component";
import { CaliburnContextMenuComponent } from "./panel/context-menu.component";
import { handleCanvasContextMenu } from "./context-menu-interaction";
import {
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  actionCut,
  actionPaste,
  copyText,
} from "./actions/actionClipboard";
import { actionToggleCropEditor } from "./actions/actionCropEditor";

import { createTestHook } from "./test-hook";
import {
  createFrameElementOnPointerDown,
  createGenericElementOnPointerDown,
  finalizeNewElementOnPointerUp,
  maybeDragNewElement,
} from "./create-interaction";
import {
  finalizeLinearOnPointerUp,
  handleHoverSelectedLinearElement,
  handleLinearEditorPointerUp,
  handleLinearElementOnPointerDown,
  handleMultiElementPointerMove,
  maybeDragLinearPoint,
  maybeSuggestBindingOnHover,
} from "./linear-interaction";
import {
  cleanupAfterDragOnPointerUp,
  renormalizeBoundElbowArrowsOnPointerUp,
  revertActiveToolOnPointerUp,
} from "./drag-interaction";
import { handleEraser, maybeEraseOnPointerUp } from "./eraser-interaction";
import {
  maybeUpdateFrameToHighlightOnPointerMove,
  resetEditingFrame,
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
  finishImageCropping,
  maybeFinishImageCroppingOnPointerUp,
} from "./crop-interaction";
import {
  endPanSession,
  gesture,
  handleCanvasPanUsingWheelOrSpaceDrag as panCanvasOnWheelOrSpaceDrag,
  isGestureActive,
  isHoldingSpace,
  isPanSessionActive,
  onGestureChange,
  onGestureEnd,
  onGestureStart,
  removePointer,
  resetGesture,
  setHoldingSpace,
  updateGestureOnPointerDown,
  updateMultiTouchGesture,
} from "./pan-gesture";
import {
  endPointerSession,
  markCanvasHandledPointerEvent,
  replayPointerSessionUp,
  startPointerSession,
} from "./pointer-session";
import {
  endScrollBarSession,
  getScrollBarsAtPointer,
  handleDraggingScrollBar,
  handlePointerMoveOverScrollbars,
  isDraggingScrollBar,
  resetScrollBarDrag,
  setCurrentScrollBars,
} from "./scrollbar-interaction";
import {
  deselectElements,
  handleCanvasDoubleClick,
  handleEnterToEditKeyDown,
  handleTextElementOnPointerUp,
  handleTextOnPointerDown,
  maybeStartTextEditingOnPointerUp,
  startImageCropping,
} from "./text-interaction";
import {
  getElementAtPosition,
  handleLassoPointerDown,
  handleSelectionPointerDown,
  handleSelectionPointerMove,
  handleSelectionPointerUp,
  initialPointerDownState,
  isHittingCommonBoundingBoxOfSelectedElements,
  maybeDeselectOnPointerUp,
  maybeDragNewGenericElement,
  maybeSelectLinearElementOnPointerUp,
  updateActiveLockedIdOnPointerUp,
} from "./selection-interaction";
import { maybeHandleResize } from "./resize-interaction";

import type { RoughCanvas } from "roughjs/bin/canvas";

import type { ElementRef, TemplateRef } from "@angular/core";

import type { CommandPaletteItem } from "./components/command-palette/types";
import type { CaliburnViewportStatusFrame } from "./components/viewport-status-frame/viewport-status-frame";
import type { CursorHintView } from "./components/cursor-hints";
import type { CaliburnEmbeddableContext } from "./components/embeddable.component";
import type { EyeDropperProperties } from "./components/eye-dropper";
import type { OverwriteConfirmState } from "./components/overwrite-confirm/overwrite-confirm-state";
import type { PointerDownState } from "./selection-interaction";
import type { CanvasDoubleClickEvent } from "./text-interaction";

import type { AfterViewInit, OnDestroy, OnInit } from "@angular/core";

/**
 * `AppEventBus` behavior for the editor lifecycle events, verbatim from
 * upstream's `editorLifecycleEventBehavior` (`App.tsx`).
 */
const editorLifecycleEventBehavior = {
  "editor:mount": { cardinality: "once", replay: "last" },
  "editor:initialize": { cardinality: "once", replay: "last" },
  "editor:unmount": { cardinality: "once", replay: "last" },
} as const;

export type CaliburnMountPayload = {
  excalidrawAPI: CaliburnImperativeAPI;
  /*
   *Excalidraw container.
   * should never be null, but just to be safe
   */
  container: HTMLDivElement | null;
};

export type CaliburnImperativeAPIEventMap = {
  "editor:mount": [payload: CaliburnMountPayload];
  "editor:initialize": [api: CaliburnImperativeAPI];
  "editor:unmount": [];
};

export interface CaliburnImperativeAPI {
  /** Whether the editor has been unmounted and the API is no longer usable. */
  isDestroyed: boolean;
  /** upstream `App.id` — the token a library install is attributed to */
  id: string;
  updateScene: CaliburnEditorComponent["updateScene"];
  applyDeltas: CaliburnEditorComponent["applyDeltas"];
  resetScene: CaliburnEditorComponent["resetScene"];
  mutateElement: CaliburnEditorComponent["mutateElement"];
  updateLibrary: CaliburnEditorComponent["library"]["updateLibrary"];
  toggleSidebar: CaliburnEditorComponent["toggleSidebar"];
  addFiles: (files: BinaryFileData[]) => void;
  getSceneElementsIncludingDeleted: () => readonly OrderedExcalidrawElement[];
  getSceneElementsMapIncludingDeleted: () => ReturnType<
    Scene["getElementsMapIncludingDeleted"]
  >;
  history: { clear: () => void };
  setViewport: AppViewport["setViewport"];
  getViewportOffsets: AppViewport["getOffsets"];
  getSceneElements: () => readonly Ordered<NonDeletedExcalidrawElement>[];
  getAppState: () => AppState;
  getFiles: () => BinaryFiles;
  registerAction: (action: Action) => void;
  setActiveTool: CaliburnEditorComponent["setActiveTool"];
  setCursor: AppCursor["set"];
  resetCursor: AppCursor["reset"];
  getEditorInterface: () => EditorInterface;
  onChange: (
    cb: (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => void,
  ) => () => void;
  onIncrement: (cb: (increment: unknown) => void) => () => void;
  onScrollChange: (
    cb: (scrollX: number, scrollY: number, zoom: AppState["zoom"]) => void,
  ) => () => void;
  onUserFollow: (cb: (payload: OnUserFollowedPayload) => void) => () => void;
  onPointerDown: (
    cb: (
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: PointerEvent,
    ) => void,
  ) => () => void;
  onPointerUp: (
    cb: (
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: PointerEvent,
    ) => void,
  ) => () => void;
  onStateChange: CaliburnEditorComponent["onStateChange"];
  onEvent: CaliburnEditorComponent["onEvent"];
}

/** a props snapshot the `interaction` predicates can be evaluated against */
type InteractionProps = {
  interaction?: boolean | InteractionConfig | null;
};

/** a props snapshot the `ui` predicates can be evaluated against */
type UIProps = {
  ui?: boolean | UIConfig | null;
};

let nextEditorId = 0;

type SetStateArg =
  | Partial<AppState>
  | ((prevState: AppState) => Partial<AppState> | null)
  | null;

/**
 * The editor shell the harness mounts. It carries the real element engine
 * (Scene, Store, History) and the upstream AppState shape; the editor
 * behavior itself arrives slice by slice, replacing pieces of this stub.
 */

// React's nested-update cap; a listener that rewrites its own key every flush
// would otherwise spin instead of failing the way upstream does
const MAX_OBSERVER_FLUSH_DEPTH = 50;

@Component({
  selector: "caliburn-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnContextMenuComponent,
    CaliburnConvertElementTypePopupComponent,
    CaliburnCursorHintComponent,
    CaliburnElementCanvasButtonsComponent,
    CaliburnEmbeddablesComponent,
    CaliburnEyeDropperComponent,
    CaliburnFrameNameComponent,
    CaliburnHyperlinkComponent,
    CaliburnIconButtonComponent,
    CaliburnLayerUIComponent,
  ],
  providers: [provideCaliburnIcons()],
  templateUrl: "./editor.component.html",
})
export class CaliburnEditorComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  readonly handleKeyboardGlobally = input(false);
  readonly autoFocus = input(false);
  readonly viewModeEnabled = input<boolean | undefined>(undefined);
  readonly activeTool = input<
    ({ type: ToolType } | { type: "custom"; customType: string }) | null
  >(null);
  readonly interaction = input<boolean | InteractionConfig | null | undefined>(
    undefined,
  );
  /**
   * Whether Excalidraw's default UI is rendered. `false` hides all of it;
   * an object hides all of it but opts individual controls back in
   * (`UIConfig["enabled"]`). Host-supplied UI (the composition slots and
   * projected children) keeps rendering either way.
   *
   * @default true
   */
  readonly ui = input<boolean | UIConfig | null | undefined>(undefined);
  readonly theme = input<Theme | undefined>(undefined);
  readonly zenModeEnabled = input<boolean | undefined>(undefined);
  readonly gridModeEnabled = input<boolean | undefined>(undefined);
  /** whether the interactive canvas paints its scroll bars (off by default,
   * as upstream's `props.renderScrollbars` is) */
  readonly renderScrollbars = input<boolean | undefined>(undefined);
  /** the scene name, seeded into `appState.name` (host-controlled) */
  readonly name = input<string | undefined>(undefined);
  /** extra class names for the editor's root `.excalidraw` element */
  readonly className = input<string | undefined>(undefined);
  /** host overrides for the default UI's actions & tools (merged over
   * `DEFAULT_UI_OPTIONS`, as upstream's `index.tsx` does) */
  readonly UIOptions = input<Partial<UIOptions> | undefined>(undefined);
  readonly onExcalidrawAPI = input<
    ((api: CaliburnImperativeAPI | null) => void) | null
  >(null);
  /** Invoked once the editor root is mounted. */
  readonly onMount = input<((payload: CaliburnMountPayload) => void) | null>(
    null,
  );
  /** Invoked when the editor root is unmounted. */
  readonly onUnmount = input<(() => void) | null>(null);
  /** Invoked once the initial scene is loaded. */
  readonly onInitialize = input<((api: CaliburnImperativeAPI) => void) | null>(
    null,
  );
  readonly onPointerDown = input<
    | ((
        activeTool: AppState["activeTool"],
        pointerDownState: PointerDownState,
        event: PointerEvent,
      ) => void)
    | null
  >(null);
  readonly onPointerUp = input<
    | ((
        activeTool: AppState["activeTool"],
        pointerDownState: PointerDownState,
        event: PointerEvent,
      ) => void)
    | null
  >(null);
  readonly onPointerUpdate = input<
    | ((payload: {
        pointer: CollaboratorPointer;
        button: "down" | "up";
        pointersMap: Gesture["pointers"];
      }) => void)
    | null
  >(null);
  /**
   * Host hook for follow/unfollow intents. The editor never owns the follow
   * state — it emits intents here (and through the imperative API's
   * `onUserFollow`) and renders the followed user from `userToFollow`.
   */
  readonly onUserFollow = input<
    ((payload: OnUserFollowedPayload) => void) | null
  >(null);
  /**
   * The user being followed on the canvas, if any. Controlled by the host.
   */
  readonly userToFollow = input<UserToFollow | null>(null);
  /** the viewport-edge border + bottom-center badge (see follow mode) */
  readonly viewportStatusFrame = input<CaliburnViewportStatusFrame | null>(
    null,
  );
  readonly imageOptions = input<{
    maxWidthOrHeight?: number;
    maxFileSizeBytes?: number;
  } | null>(null);
  readonly initialData = input<{
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    libraryItems?: LibraryItemsSource;
    scrollToContent?: boolean;
  } | null>(null);
  readonly libraryReturnUrl = input<string | undefined>(undefined);
  readonly onLibraryChange = input<
    ((libraryItems: LibraryItems) => void) | null
  >(null);
  readonly initialState = input<{
    viewport?: Omit<SetViewportOptions, "animation">;
  } | null>(null);
  readonly onThemeChange = input<
    ((theme: AppState["theme"] | "system") => void) | null
  >(null);
  /**
   * Host hook for element-link clicks. Called before the editor opens the
   * URL; `event.preventDefault()` suppresses the `window.open`.
   */
  readonly onLinkOpen = input<
    | ((
        element: NonDeletedExcalidrawElement,
        event: CustomEvent<{ nativeEvent: MouseEvent }>,
      ) => void)
    | null
  >(null);
  /** upstream's `validateEmbeddable` — widens (or narrows) the set of URLs
   * an embeddable element accepts (`embeddableURLValidator`) */
  readonly validateEmbeddable = input<
    | boolean
    | string[]
    | RegExp
    | RegExp[]
    | ((link: string) => boolean | undefined)
    | undefined
  >(undefined);
  /**
   * upstream's `renderEmbeddable` render prop — replaces the default
   * `<iframe>` for an embeddable element with the host's own content.
   * Upstream's is `(element, appState) => JSX.Element | null`; Angular
   * renders a template rather than a returned node, so the function returns
   * the `TemplateRef` to render (instantiated with `{ $implicit: element,
   * appState }`). `null` keeps upstream's contract exactly: that element
   * falls back to the default iframe, per element.
   */
  readonly renderEmbeddable = input<
    | ((
        element: NonDeleted<ExcalidrawEmbeddableElement>,
        appState: AppState,
      ) => TemplateRef<CaliburnEmbeddableContext> | null)
    | null
  >(null);
  /** upstream's `<CommandPalette customCommandPaletteItems>` (the palette is
   * a host-rendered child upstream; caliburn's LayerUI renders it) */
  readonly customCommandPaletteItems = input<CommandPaletteItem[]>([]);

  /**
   * Host-composition slots — the Angular equivalent of upstream's LayerUI
   * tunnels (`context/tunnels.ts`): a host app hands the editor one
   * `TemplateRef` per outlet and LayerUI renders it where upstream renders
   * that tunnel's `Out`, in place of the built-in default. Upstream reaches
   * the outlets from arbitrary depth in the host's tree (tunnel-rat portals
   * + `withInternalFallback` to suppress the default); Angular renders a
   * template only where it's instantiated, so the template comes in as an
   * input instead — which also makes "did the host supply one?" a plain
   * read rather than a mount-counting heuristic.
   *
   * `topLeftUI` / `topRightUI` are upstream's `renderTopLeftUI` /
   * `renderTopRightUI` render props (its two non-tunnel outlets), spelled
   * the same way for consistency.
   */
  readonly mainMenu = input<TemplateRef<unknown> | null>(null);
  readonly welcomeScreenCenter = input<TemplateRef<unknown> | null>(null);
  readonly welcomeScreenMenuHint = input<TemplateRef<unknown> | null>(null);
  readonly welcomeScreenToolbarHint = input<TemplateRef<unknown> | null>(null);
  readonly welcomeScreenHelpHint = input<TemplateRef<unknown> | null>(null);
  readonly footerCenter = input<TemplateRef<unknown> | null>(null);
  readonly topLeftUI = input<TemplateRef<unknown> | null>(null);
  readonly topRightUI = input<TemplateRef<unknown> | null>(null);
  readonly sidebar = input<TemplateRef<unknown> | null>(null);
  /**
   * Upstream's `currentUserControls` prop, rendered inside the UserList
   * "who's here" dropdown below a divider. Upstream also accepts a render
   * function (called with `isMobile`); caliburn's LayerUI ports the desktop
   * layout only, so the slot is a plain template.
   */
  readonly currentUserControls = input<TemplateRef<unknown> | null>(null);

  /**
   * Number of host-rendered `caliburn-default-sidebar`s, standing in for
   * upstream's `withInternalFallback` mount counter: LayerUI's own default
   * sidebar renders only while this is 0.
   */
  readonly hostDefaultSidebars = signal(0);

  readonly containerRef = viewChild<ElementRef<HTMLDivElement>>("container");
  readonly staticCanvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("staticCanvas");
  readonly svgLayerRef = viewChild<ElementRef<SVGSVGElement>>("svgLayer");
  readonly newElementCanvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("newElementCanvas");
  readonly interactiveCanvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("interactiveCanvas");

  /**
   * Bumped on every commit so child views (the panels) that read it are
   * marked dirty and refresh in the same synchronous change-detection pass.
   */
  readonly changeGeneration = signal(0);

  /**
   * Upstream's `App.tsx` toggles `theme--dark` on the `.excalidraw` container
   * from `appState.theme` on every update; caliburn binds this on the same
   * element, and `createPortalContainer` puts it on the body-level containers
   * so the CSS-variable scope follows the modals out of the container.
   */
  readonly isDarkTheme = computed(() => {
    this.changeGeneration();
    return this.state.theme === THEME.DARK;
  });

  get canvas(): HTMLCanvasElement {
    return this.staticCanvasRef()!.nativeElement;
  }

  rc: RoughCanvas | null = null;

  iFrameRefs = new Map<ExcalidrawElement["id"], HTMLIFrameElement>();
  /**
   * Indicates whether the embeddable's url has been validated for rendering.
   * If value not set, indicates that the validation is pending.
   * Initially or on url change the flag is not reset so that we can guarantee
   * the validation came from a trusted source (the editor).
   **/
  embedsValidationStatus: EmbedsValidationStatus = new Map();
  /** embeds that have been inserted to DOM (as a perf optim, we don't want to
   * insert to DOM before user initially scrolls to them) */
  initializedEmbeds = new Set<ExcalidrawIframeLikeElement["id"]>();

  elementsPendingErasure: ElementsPendingErasure = new Set();

  private scheduleImageRefresh = createScheduleImageRefresh(this);

  renderInteractiveSceneCallback = ({
    scrollBars,
  }: RenderInteractiveSceneCallback) => {
    if (scrollBars) {
      setCurrentScrollBars(scrollBars);
    }

    this.scheduleImageRefresh();
  };

  state: AppState = {
    ...getDefaultAppState(),
    // upstream seeds the scene name at construction, from `props.name` or the
    // dated default (`App.tsx`); the `name` input is read over this in
    // `ngOnInit`, once inputs are readable
    name: `${t("labels.untitled")}-${getDateTime()}`,
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
  readonly undoAction = createUndoAction(this.history);
  readonly redoAction = createRedoAction(this.history);
  readonly lassoTrail = new LassoTrail(this as any);
  readonly laserTrails = new LaserTrails(this as any);
  readonly eraserTrail = new EraserTrail(this as any);
  readonly cursorHints = new CursorHints(this);

  /** the mounted `<caliburn-cursor-hint>`, if any (see `CursorHints`) */
  cursorHintView: CursorHintView | null = null;

  /**
   * Upstream keeps the open eye dropper in a module-level jotai atom
   * (`EyeDropper.tsx`'s `activeEyeDropperAtom`) — mirrored here as a
   * per-instance signal, as `activeConfirmDialog` above is.
   */
  readonly activeEyeDropper = signal<EyeDropperProperties | null>(null);

  /**
   * Upstream keeps the open shape-switch panel in a module-level jotai atom
   * (`ConvertElementTypePopup.tsx`'s `convertElementTypePopupAtom`) —
   * mirrored here as a per-instance signal, as `activeEyeDropper` above is.
   */
  readonly convertElementTypePopup = signal<{ type: "panel" } | null>(null);

  readonly showShapeSwitchPanel = computed(
    () => this.convertElementTypePopup()?.type === "panel",
  );

  visibleElements: readonly NonDeletedExcalidrawElement[] = [];

  hasRenderableElements = false;

  /**
   * Upstream's `editorInterfaceContextInitialValue` (`App.tsx`), value for
   * value — `refreshEditorInterface` measures the container and replaces
   * every field but `isTouchScreen`. Signal-backed rather than a plain field
   * so a `computed()` that reads `editor.editorInterface.*` — every consumer
   * does — re-runs when a resize changes it; upstream gets that for free by
   * re-rendering off `updateObject`'s new identity.
   */
  private readonly editorInterfaceSignal = signal<EditorInterface>({
    formFactor: "desktop",
    desktopUIMode: "full",
    userAgent: createUserAgentDescriptor(
      typeof navigator !== "undefined" ? navigator.userAgent : "",
    ),
    isTouchScreen: false,
    canFitSidebar: false,
    isLandscape: true,
  });

  get editorInterface(): EditorInterface {
    return this.editorInterfaceSignal();
  }

  /**
   * Upstream's private `App.stylesPanelMode` field (`App.tsx`), seeded from
   * the same initial editor interface. It exists only so
   * `reconcileStylesPanelMode` can spot a *transition* — every consumer reads
   * `deriveStylesPanelMode(editorInterface)` instead, as upstream's
   * `useStylesPanelMode()` does.
   */
  private stylesPanelMode = deriveStylesPanelMode(this.editorInterfaceSignal());

  private resizeObserver: ResizeObserver | null = null;

  unmounted = false;

  readonly viewport = new AppViewport(this as any, {
    getContainer: () => this.containerRef()?.nativeElement ?? null,
    getStylesPanelMode: () => this.stylesPanelMode,
    isGestureActive,
  });

  readonly props = {
    // Cloned: `DEFAULT_UI_OPTIONS` is a vendored module-level object shared
    // with the rest of the workspace. `canvasActions.toggleTheme` is
    // normalized from its `null` default in `ngOnInit`, once the `theme`
    // input is readable (`index.tsx`).
    UIOptions: {
      ...DEFAULT_UI_OPTIONS,
      canvasActions: { ...DEFAULT_UI_OPTIONS.canvasActions },
    },
    onDuplicate: undefined as unknown,
    theme: undefined as Theme | undefined,
    zenModeEnabled: undefined as boolean | undefined,
    gridModeEnabled: undefined as boolean | undefined,
    name: undefined as string | undefined,
    onThemeChange: undefined as
      | ((theme: AppState["theme"] | "system") => void)
      | undefined,
    onLibraryChange: undefined as
      | ((libraryItems: LibraryItems) => void)
      | undefined,
    libraryReturnUrl: undefined as string | undefined,
    imageOptions: { ...DEFAULT_IMAGE_OPTIONS },
  };

  /**
   * Upstream's `App.id` (a `nanoid()`), used as the libraries.excalidraw.com
   * browse token. A per-instance counter stands in: `nanoid` is a
   * `packages/excalidraw` dependency caliburn doesn't carry, and
   * `randomId()` draws from the same test-env sequence the element ids do.
   */
  readonly id = `caliburn-editor-${nextEditorId++}`;

  /**
   * upstream `App.getFrameNameDOMId` — public here because the frame names
   * are rendered by their own component (`frame-name.component`), which has
   * to stamp the id the cache below looks the node up by.
   */
  getFrameNameDOMId = (frameElement: ExcalidrawElement) => {
    return `${this.id}-frame-name-${frameElement.id}`;
  };

  frameNameBoundsCache: FrameNameBoundsCache = {
    get: (frameElement) => {
      let bounds = this.frameNameBoundsCache._cache.get(frameElement.id);
      if (
        !bounds ||
        bounds.zoom !== this.state.zoom.value ||
        bounds.versionNonce !== frameElement.versionNonce
      ) {
        const frameNameDiv = document.getElementById(
          this.getFrameNameDOMId(frameElement),
        );

        if (frameNameDiv) {
          const box = frameNameDiv.getBoundingClientRect();
          const boxSceneTopLeft = viewportCoordsToSceneCoords(
            { clientX: box.x, clientY: box.y },
            this.state,
          );
          const boxSceneBottomRight = viewportCoordsToSceneCoords(
            { clientX: box.right, clientY: box.bottom },
            this.state,
          );

          bounds = {
            x: boxSceneTopLeft.x,
            y: boxSceneTopLeft.y,
            width: boxSceneBottomRight.x - boxSceneTopLeft.x,
            height: boxSceneBottomRight.y - boxSceneTopLeft.y,
            zoom: this.state.zoom.value,
            versionNonce: frameElement.versionNonce,
          };

          this.frameNameBoundsCache._cache.set(frameElement.id, bounds);

          return bounds;
        }
        return null;
      }

      return bounds;
    },
    /**
     * @private
     */
    _cache: new Map(),
  };

  /**
   * The library state class is vendored (`data/library.ts`) and takes the app
   * instance: it reads `props.onLibraryChange` and calls `setState` /
   * `focusContainer` on it.
   */
  readonly library = new Library(this as any);

  /**
   * Upstream's `libraryItemsAtom` (`data/library.ts`), which the vendored
   * `Library` writes to through its own jotai store — mirrored into a signal
   * so the Angular library UI re-renders on it.
   */
  readonly libraryItemsData = signal(editorJotaiStore.get(libraryItemsAtom));

  private readonly unsubLibraryItems = editorJotaiStore.sub(
    libraryItemsAtom,
    () => {
      this.libraryItemsData.set(editorJotaiStore.get(libraryItemsAtom));
    },
  );

  /** the theme the *next* image export renders with, when the user overrode
   * it in the image-export dialog (upstream `App.sessionExportThemeOverride`) */
  sessionExportThemeOverride: AppState["theme"] | undefined;

  /**
   * Upstream keeps the clear-canvas confirmation in a per-editor jotai atom
   * (`ActiveConfirmDialog.tsx`'s `activeConfirmDialogAtom`), not in appState —
   * mirrored here as a per-instance signal.
   */
  readonly activeConfirmDialog = signal<"clearCanvas" | null>(null);

  /**
   * Upstream puts `<BraveMeasureTextError />` straight into
   * `appState.errorMessage`, which is a `ReactNode`; caliburn's error dialog
   * projects a string, so the one renderable error message it can raise is a
   * flag of its own instead.
   */
  readonly braveMeasureTextError = signal(false);

  /**
   * Upstream keeps the overwrite-confirmation modal in a module-level jotai
   * atom (`OverwriteConfirm/OverwriteConfirmState.ts`) — mirrored here as a
   * per-instance signal, as `activeConfirmDialog` above is.
   */
  readonly overwriteConfirm = signal<OverwriteConfirmState>({ active: false });

  /**
   * The search menu's two per-editor jotai atoms (`SearchMenu.tsx`'s
   * `searchQueryAtom` / `searchItemInFocusAtom`) as per-instance signals —
   * they outlive the menu, which is mounted and unmounted with its sidebar.
   */
  readonly searchQuery = signal("");
  readonly searchItemInFocus = signal<number | null>(null);

  imageCache: Map<
    FileId,
    {
      image: HTMLImageElement | Promise<HTMLImageElement>;
      mimeType: ValueOf<typeof IMAGE_MIME_TYPES>;
    }
  > = new Map();

  lastPointerDownEvent: PointerEvent | null = null;

  /** the last pointer move the canvas itself saw — upstream
   * `App.lastPointerMoveEvent`, which stands in for a missing pointer up when
   * the eraser's gesture is torn down without one */
  lastPointerMoveEvent: PointerEvent | null = null;

  lastPointerMoveCoords: { x: number; y: number } | null = null;

  /**
   * the scene coords of the pointer-move before the one being handled —
   * upstream `App.previousPointerMoveCoords`, read by the crop-region pan,
   * which moves by the instantaneous delta between two moves rather than by
   * the offset from the drag origin. Reset with the rest of the drag on
   * pointer up.
   */
  previousPointerMoveCoords: { x: number; y: number } | null = null;

  /** the element whose link icon the pointer is currently over, if any */
  hitLinkElement: NonDeletedExcalidrawElement | undefined;

  /** the delayed bind mode's countdown, also read by the vendored renderer
   * (`interactiveScene.ts`) to fade the binding highlight in */
  bindModeHandler: ReturnType<typeof setTimeout> | null = null;

  readonly delayedBindMode = new CaliburnBindMode(this);

  readonly flowchart = new CaliburnFlowchart(this);

  files: BinaryFiles = {};

  textWysiwygSubmitHandler: (() => void) | null = null;

  readonly cursor = new AppCursor(this as any);

  get interactiveCanvas(): HTMLCanvasElement | null {
    return this.interactiveCanvasRef()?.nativeElement ?? null;
  }

  /**
   * Whether the active tool captures the primary pointer instead of the
   * view-mode drag-to-pan — the laser and host-implemented custom tools do;
   * while non-interactive, any tool allowed via `interaction.enabled.tools`
   * does.
   */
  isActiveToolPointerCapturing(): boolean {
    if (!this.isInteractionEnabled()) {
      // an active tool that isn't allowed via `interaction.enabled.tools`
      // is inert — including the laser
      return this.isToolSupported(this.state.activeTool.type);
    }
    return (
      this.state.activeTool.type === "laser" ||
      this.state.activeTool.type === "custom"
    );
  }

  readonly bucketFill = new CaliburnBucketFill(this);

  readonly touchInput = new CaliburnTouchInput(this);

  readonly arrowText = new CaliburnArrowText(this);

  /** upstream's `clearSelectionIfNotUsingSelection`, queued but not applied */
  private pendingSelectionClear = false;
  private pendingIsBindingEnabledRestore = false;

  lastCompletedCanvasClicks: { x: number; y: number }[] = [];

  lastPointerUpEvent: PointerEvent | null = null;

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

  readonly onUserFollowEmitter = new Emitter<
    [payload: OnUserFollowedPayload]
  >();

  /**
   * Upstream's emitter of the same name, minus the in-flight gesture's own
   * subscription — caliburn's pointer session replays its teardown itself
   * (`pointer-session.ts`), so this carries only the subscribers upstream
   * adds from outside a gesture.
   */
  private readonly missingPointerEventCleanupEmitter = new Emitter<
    [event: PointerEvent | null]
  >();

  readonly onPointerDownEmitter = new Emitter<
    [
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: PointerEvent,
    ]
  >();

  readonly onPointerUpEmitter = new Emitter<
    [
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: PointerEvent,
    ]
  >();

  private readonly editorLifecycleEvents = new AppEventBus<
    CaliburnImperativeAPIEventMap,
    typeof editorLifecycleEventBehavior
  >(editorLifecycleEventBehavior);

  readonly onEvent = this.editorLifecycleEvents.on.bind(
    this.editorLifecycleEvents,
  ) as AppEventBus<
    CaliburnImperativeAPIEventMap,
    typeof editorLifecycleEventBehavior
  >["on"];

  private readonly appStateObserver = new AppStateObserver(() => this.state);

  readonly onStateChange: OnStateChange = this.appStateObserver.onStateChange;

  /**
   * The appState the observer was last flushed against — upstream reads it off
   * `componentDidUpdate(prevProps, prevState)`, caliburn snapshots it at the
   * same point in `commit()`. Seeded with the constructed state (not lazily at
   * the first flush) because a child's field initializer can subscribe before
   * `ngOnInit` seeds appState from the inputs — upstream applies those in the
   * constructor, ahead of any consumer, so this first flush is what closes
   * the same gap here.
   */
  private observedState: AppState = this.state;

  private flushingObservers = false;

  private observerFlushPending = false;

  // scroll `elements` into view only if they aren't already fully visible.
  // Targets their bounds rather than the elements so it also works for
  // elements not yet committed to the canvas.
  revealIfHidden = (elements: NonDeletedExcalidrawElement[]) => {
    if (
      !elements.length ||
      isElementCompletelyInViewport(
        elements,
        this.canvas.width / window.devicePixelRatio,
        this.canvas.height / window.devicePixelRatio,
        {
          offsetLeft: this.state.offsetLeft,
          offsetTop: this.state.offsetTop,
          scrollX: this.state.scrollX,
          scrollY: this.state.scrollY,
          zoom: this.state.zoom,
        },
        this.scene.getNonDeletedElementsMap(),
        this.viewport.getOffsets(),
      )
    ) {
      return;
    }

    this.viewport.setViewport({
      target: getCommonBounds(elements),
      fit: "scale-down",
      animation: { duration: 300 },
      offsets: { ui: true },
    });
  };

  /** emits a follow/unfollow intent to the host (which owns the
   *  `userToFollow` state) via both the `onUserFollow` prop and the
   *  imperative API emitter */
  emitUserFollowIntent = (payload: OnUserFollowedPayload) => {
    this.onUserFollowEmitter.trigger(payload);
    this.onUserFollow()?.(payload);
  };

  /** emits an UNFOLLOW intent if currently following someone — use on
   *  user-initiated viewport changes which should break follow mode */
  requestUnfollow = () => {
    const userToFollow = this.userToFollow();
    if (userToFollow) {
      this.emitUserFollowIntent({
        userToFollow,
        action: "UNFOLLOW",
      });
    }
  };

  /**
   * upstream `App.savePointer` — broadcasts the local pointer to the host
   * (`props.onPointerUpdate`), which relays it to collaborators
   */
  savePointer = (x: number, y: number, button: "up" | "down") => {
    // don't broadcast pointer updates (props.onPointerUpdate) when
    // non-interactive, unless the active tool stays user-driven via
    // `interaction.enabled.tools` — collaborators render e.g. a presenter's
    // laser through these updates
    if (
      !this.isInteractionEnabled() &&
      !this.isToolSupported(this.state.activeTool.type)
    ) {
      return;
    }
    if (!x || !y) {
      return;
    }
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      { clientX: x, clientY: y },
      this.state,
    );

    if (isNaN(sceneX) || isNaN(sceneY)) {
      // sometimes the pointer goes off screen
    }

    const pointer: CollaboratorPointer = {
      x: sceneX,
      y: sceneY,
      tool: this.state.activeTool.type === "laser" ? "laser" : "pointer",
    };

    this.onPointerUpdate()?.({
      pointer,
      button,
      pointersMap: gesture.pointers,
    });
  };

  readonly drawShape = new CaliburnDrawShape(this);

  /**
   * `props.interaction` for a given props snapshot, normalized: the input
   * is `null` rather than `undefined` when a rerender drops the prop, which
   * would otherwise read as an (empty) config object. Omitting `props`
   * means the current props — the predicates below take the whole snapshot
   * (as upstream does) rather than the bare value, so that passing a
   * previous `undefined` can't fall through to the current value.
   */
  private interactionOf(
    props?: InteractionProps,
  ): boolean | InteractionConfig | undefined {
    return (props ? props.interaction : this.interaction()) ?? undefined;
  }

  /**
   * Whether the editor accepts user input (pointer, keyboard, wheel, touch,
   * clipboard, drag&drop). When `false`, the editor is fully inert for the
   * user, but remains controllable through the imperative API.
   *
   * All user-input entry points must consult this getter (directly or by
   * not being attached/rendered at all).
   */
  isInteractionEnabled(props?: InteractionProps): boolean {
    const interaction = this.interactionOf(props);
    return interaction !== false && typeof interaction !== "object";
  }

  /**
   * Whether element links render their link icon and are clickable. True
   * when fully interactive, or when `interaction: { enabled: { links: true } }`.
   */
  isLinksEnabled(props?: InteractionProps): boolean {
    const interaction = this.interactionOf(props);
    if (typeof interaction === "object") {
      return (
        interaction.enabled?.links === true ||
        interaction.enabled?.interactiveContent === true
      );
    }
    return interaction !== false;
  }

  /**
   * Whether canvas navigation — panning & zooming, view-mode style — is
   * enabled. True when fully interactive, or when `interaction: { enabled:
   * { navigation: true } }`. Respects `appState.scrollConstraints`.
   */
  isNavigationEnabled(props?: InteractionProps): boolean {
    const interaction = this.interactionOf(props);
    if (typeof interaction === "object") {
      return interaction.enabled?.navigation === true;
    }
    return interaction !== false;
  }

  /**
   * Whether embeddable & iframe elements are interactive. True when fully
   * interactive, or when allowed via `interaction.enabled.embeds` /
   * `.interactiveContent`.
   */
  isEmbedsEnabled(props?: InteractionProps): boolean {
    const interaction = this.interactionOf(props);
    if (typeof interaction === "object") {
      return (
        interaction.enabled?.embeds === true ||
        interaction.enabled?.interactiveContent === true
      );
    }
    return interaction !== false;
  }

  /**
   * Whether the browser's own zoom (ctrl/cmd + wheel, pinch) stays
   * available over the non-interactive editor. Prevented by default.
   */
  isBrowserZoomEnabled(props?: InteractionProps): boolean {
    const interaction = this.interactionOf(props);
    if (typeof interaction === "object") {
      return interaction.enabled?.browserZoom === true;
    }
    return false;
  }

  /** Whether Excalidraw's full default UI is rendered. */
  isDefaultUIEnabled(props: UIProps = { ui: this.ui() }): boolean {
    return (
      props.ui !== false && (typeof props.ui !== "object" || props.ui === null)
    );
  }

  /** Whether an individual default UI control is rendered. */
  isUIControlEnabled(
    control: keyof UIConfig["enabled"],
    props: UIProps = { ui: this.ui() },
  ): boolean {
    if (typeof props.ui === "object" && props.ui !== null) {
      return props.ui.enabled?.[control] === true;
    }
    return props.ui !== false;
  }

  /**
   * Mirrors upstream `App.tsx`'s `renderWelcomeScreen` prop passed to
   * `LayerUI`/`Footer`: the welcome screen shows on an empty, idle scene —
   * not while loading, not once the user has left the selection tool, not in
   * zen mode, and not once any element (including deleted ones) exists.
   */
  renderWelcomeScreen(): boolean {
    return (
      !this.state.isLoading &&
      this.state.showWelcomeScreen &&
      this.state.activeTool.type === this.state.preferredSelectionTool.type &&
      !this.state.zenModeEnabled &&
      !this.scene.getElementsIncludingDeleted().length
    );
  }

  /**
   * Upstream's `.excalidraw` container carries
   * `--right-sidebar-width: ${RIGHT_SIDEBAR_WIDTH}px` inline (`App.tsx`); the
   * sidebar's own width and the docked UI layer's `calc()`s read it from there.
   */
  readonly rightSidebarWidth = `${RIGHT_SIDEBAR_WIDTH}px`;

  get uiPointerEvents() {
    const shouldBlockPointerEvents =
      // default back to `--ui-pointerEvents` flow if setPointerCapture
      // not supported
      "setPointerCapture" in HTMLElement.prototype
        ? false
        : this.state.selectionElement ||
          this.state.newElement ||
          this.state.selectedElementsAreBeingDragged ||
          this.state.resizingElement ||
          (this.state.activeTool.type === "laser" &&
            this.state.cursorButton === "down");

    return shouldBlockPointerEvents
      ? POINTER_EVENTS.disabled
      : POINTER_EVENTS.enabled;
  }

  syncActionResult = (actionResult: ActionResult) => {
    if (this.unmounted || actionResult === false) {
      return;
    }
    this.batchCommits(() => this.syncActionResultImpl(actionResult));
  };

  private syncActionResultImpl = (
    actionResult: Exclude<ActionResult, false>,
  ) => {
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
  private observedLanguageGeneration = untracked(languageGenerationSignal);
  private pointerDownState: PointerDownState | null = null;

  constructor() {
    // react to the host-controlled props that drive editor state
    // (`props.interaction`, `props.viewModeEnabled`, `props.activeTool`) —
    // the equivalent of upstream's `componentDidUpdate`, whose handlers run
    // in this same order (`App.tsx`). The props upstream merely re-resolves
    // per render (`UIOptions`, `gridModeEnabled`, `name`, `libraryReturnUrl`)
    // are refreshed first, so the chrome `handlePropsChange` re-renders reads
    // the current values.
    effect(() => {
      const interaction = this.interaction();
      const viewModeEnabled = this.viewModeEnabled();
      const forcedTool = this.activeTool();
      const theme = this.theme();
      this.UIOptions();
      this.gridModeEnabled();
      this.name();
      this.libraryReturnUrl();
      untracked(() => {
        if (this.unmounted || !this.removeSceneUpdateListener) {
          // pre-mount: `ngOnInit` seeds the initial state from the props
          return;
        }
        this.syncHostProps();
        const prevProps = {
          interaction: this.prevInteraction,
          viewModeEnabled: this.prevViewModeEnabled,
          activeTool: this.prevForcedTool,
          theme: this.prevTheme,
        };
        this.prevInteraction = interaction;
        this.prevTheme = theme;
        this.prevViewModeEnabled = viewModeEnabled;
        this.prevForcedTool = forcedTool;
        this.handlePropsChange(prevProps);
      });
    });

    // upstream's `updateLanguage` follows `setLanguage` with a
    // `setAppState({})` so the whole tree re-renders and every `t()` in a
    // render body re-resolves. The chrome's `translated()` labels track the
    // language edge on their own; this commit is what reaches the readers
    // that re-resolve `t()` off `changeGeneration()` instead.
    effect(() => {
      const generation = languageGenerationSignal();
      untracked(() => {
        if (
          generation === this.observedLanguageGeneration ||
          this.unmounted ||
          !this.removeSceneUpdateListener
        ) {
          // pre-mount there is nothing to relabel yet; `ngOnInit` renders
          // against whichever language is current by then
          return;
        }
        this.observedLanguageGeneration = generation;
        this.setState({});
      });
    });

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
      actionAlignTop,
      actionAlignBottom,
      actionAlignLeft,
      actionAlignRight,
      actionAlignVerticallyCentered,
      actionAlignHorizontallyCentered,
      distributeHorizontally,
      distributeVertically,
      actionBindText,
      actionUnbindText,
      actionWrapTextInContainer,
      actionTextAutoResize,
      actionToggleElementLock,
      actionToggleLinearEditor,
      actionTogglePolygon,
      actionUnlockAllElements,
      actionDecreaseFontSize,
      actionIncreaseFontSize,
      actionChangeStrokeColor,
      actionChangeBackgroundColor,
      actionChangeBucketFillBackgroundColor,
      actionChangeFillStyle,
      actionChangeStrokeWidth,
      actionChangeSloppiness,
      actionChangeFreedrawMode,
      actionChangeStrokeStyle,
      actionChangeOpacity,
      actionChangeFontSize,
      actionChangeFontFamily,
      actionChangeTextAlign,
      actionChangeVerticalAlign,
      actionChangeRoundness,
      actionChangeArrowhead,
      actionChangeArrowProperties,
      actionChangeArrowType,
      actionCopy,
      actionCut,
      actionPaste,
      actionCopyAsPng,
      actionCopyAsSvg,
      copyText,
      actionToggleCropEditor,
      actionCopyStyles,
      actionPasteStyles,
      actionAddToLibrary,
      actionSelectAllElementsInFrame,
      actionRemoveAllElementsFromFrame,
      actionWrapSelectionInFrame,
      actionupdateFrameRendering,
      actionLink,
      actionCopyElementLink,
      actionLinkToElement,
      actionShortcuts,
      actionToggleSearchMenu,
      actionToggleGridMode,
      actionToggleObjectsSnapMode,
      actionToggleArrowBinding,
      actionToggleMidpointSnapping,
      actionToggleZenMode,
      actionToggleStats,
      actionToggleViewMode,
      actionLoadScene,
      actionSaveToActiveFile,
      actionSaveFileToDisk,
      actionChangeProjectName,
      actionChangeExportBackground,
      actionChangeExportEmbedScene,
      actionChangeExportScale,
      actionExportWithDarkMode,
      actionGoToCollaborator,
      this.undoAction,
      this.redoAction,
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

    // upstream's constructor call (`App.tsx`), which runs before the container
    // is in the DOM and therefore always returns early. Kept as its own call
    // site because the ordering upstream relies on hangs off it: the scene is
    // initialized (`initializeScene`, which seeds `preferredSelectionTool`
    // from the form factor) against the unmeasured, desktop interface, and the
    // first real measurement arrives from the container `ResizeObserver` —
    // whose initial callback a browser fires right after `observe()` and jsdom
    // never fires at all.
    this.refreshEditorInterface();
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

    this.props.onLibraryChange = this.onLibraryChange() ?? undefined;

    const theme = this.theme();
    this.props.theme = theme;
    this.props.onThemeChange = this.onThemeChange() ?? undefined;
    if (theme) {
      this.state = { ...this.state, theme };
    }

    this.syncHostProps();

    const zenModeEnabled = this.zenModeEnabled();
    this.props.zenModeEnabled = zenModeEnabled;
    // upstream seeds `state.gridModeEnabled` and `state.name` from the props
    // in its constructor and never re-syncs them (`componentDidUpdate`);
    // `syncHostProps` keeps the props themselves live for the reads that go
    // through them (`isGridModeEnabled`, `getName`)
    this.state = {
      ...this.state,
      zenModeEnabled: zenModeEnabled ?? false,
      gridModeEnabled: this.props.gridModeEnabled ?? this.state.gridModeEnabled,
      name: this.props.name ?? this.state.name,
    };

    const viewModeEnabled = this.viewModeEnabled();
    if (!this.isInteractionEnabled()) {
      // non-interactive editor implies view mode so that all edit-mode
      // gates apply
      this.state = { ...this.state, viewModeEnabled: true };
    } else if (viewModeEnabled !== undefined) {
      this.state = { ...this.state, viewModeEnabled };
    }

    const forcedTool = this.activeTool();
    if (forcedTool) {
      if ((forcedTool.type as string) === "image") {
        console.warn(`"image" tool cannot be forced via "props.activeTool"`);
      } else if (!this.isToolSupported(forcedTool.type)) {
        console.warn(
          `"${forcedTool.type}" tool ("props.activeTool") cannot be activated — disabled via "UIOptions.tools", or not enabled while non-interactive (see "interaction.enabled.tools")`,
        );
      } else {
        this.state = {
          ...this.state,
          activeTool: updateActiveTool(this.state, forcedTool),
        };
      }
    }

    this.prevInteraction = this.interaction();
    this.prevViewModeEnabled = viewModeEnabled;
    this.prevForcedTool = forcedTool;
    this.prevTheme = theme;

    this.onExcalidrawAPI()?.(this.getApi());

    this.store.onDurableIncrementEmitter.on((increment) => {
      this.history.record(increment.delta);
    });
    this.removeSceneUpdateListener = this.scene.onUpdate(() => {
      this.commit();
      if (this.batchDepth === 0) {
        this.cdr.detectChanges();
      }
    });

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointermove", this.updateCurrentCursorPosition);
    // upstream's document-level `removePointer` (`App.tsx`, "#3553"): a
    // release that never reaches the canvas — a pan or a pinch let go over
    // the UI — would otherwise leave the pointer in `gesture.pointers`, and
    // the stale entry makes the next press look like a second finger
    document.addEventListener("pointerup", this.removeDocumentPointer);
    document.addEventListener(
      "gesturestart",
      this.onGestureStart as EventListener,
    );
    document.addEventListener(
      "gesturechange",
      this.onGestureChange as EventListener,
    );
    document.addEventListener("gestureend", this.onGestureEnd as EventListener);
    document.addEventListener("paste", this.pasteFromClipboard);
    document.addEventListener("copy", this.onCopy);
    document.addEventListener("cut", this.onCut);
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    window.addEventListener("resize", this.onWindowResize);
    window.addEventListener("focus", this.onWindowFocus);
    window.addEventListener("unload", this.onWindowUnload);
    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("message", onWindowMessage);

    this.commit();
  }

  private onWindowResize = () => {
    this.refreshEditorInterface();
    this.updateDOMRect();
    // upstream's `onResize` is `withBatchedUpdates`, so React has re-rendered
    // by the time the handler returns — a resize that changes the form factor
    // has swapped the whole chrome over before anything can read the DOM
    this.cdr.detectChanges();
  };

  private onWindowFocus = () => {
    this.maybeCleanupAfterMissingPointerUp(null);
  };

  /**
   * Upstream's `updateCurrentCursorPosition` (`App.tsx`), bound to DOCUMENT
   * pointermove so the last cursor position keeps tracking while the pointer
   * is over the UI islands, the sidebar, or anywhere else off the canvas —
   * paste placement, the eye dropper, the cursor hints and the wheel-zoom
   * anchor all read it. Upstream registers it from both the navigation-only
   * and the view+edit listener branches, so it is live whenever either is on
   * and frozen when neither is; caliburn registers once and reads the same
   * pair of gates here.
   */
  private updateCurrentCursorPosition = (event: PointerEvent) => {
    if (!this.isInteractionEnabled() && !this.isNavigationEnabled()) {
      return;
    }
    this.viewport.lastPosition.x = event.clientX;
    this.viewport.lastPosition.y = event.clientY;
  };

  /**
   * Safari-only desktop pinch. Upstream registers the three handlers from
   * both its navigation-only and its view+edit listener branch; caliburn
   * registers once and the `isNavigationEnabled()` gate upstream's bodies
   * already carry is what decides whether they run.
   */
  private onGestureStart = (event: GestureEvent) => {
    this.batchCommits(() => onGestureStart(this, event));
  };

  private onGestureChange = (event: GestureEvent) => {
    this.batchCommits(() => onGestureChange(this, event));
  };

  private onGestureEnd = (event: GestureEvent) => {
    this.batchCommits(() => onGestureEnd(this, event));
  };

  /**
   * Upstream's `disableEvent` bound to the container's three gesture events,
   * registered only while the editor is non-interactive with neither
   * navigation nor the browser's own zoom enabled — the pinch half of the
   * case whose wheel half `handleWheel` carries. Caliburn binds it from the
   * template and folds that registration gate into the handler.
   */
  disableGestureEvent(event: Event) {
    if (
      !this.isInteractionEnabled() &&
      !this.isBrowserZoomEnabled() &&
      !this.isNavigationEnabled()
    ) {
      event.preventDefault();
    }
  }

  /**
   * Upstream's `onBlur`: the space bar's keyup lands wherever the focus went,
   * so a window that loses focus mid-hold must forget it was held — and the
   * same goes for the ctrl that suspends binding.
   */
  private onWindowBlur = () => {
    setHoldingSpace(false);
    this.setState({
      isBindingEnabled: this.state.bindingPreference === "enabled",
    });
  };

  /** upstream's `onUnload`, which is `onBlur` again: a page being torn down
   * never delivers the keyup that would release a held modifier, and the
   * bfcache can restore the editor with it still latched */
  private onWindowUnload = () => {
    this.onWindowBlur();
  };

  /**
   * upstream `App.toggleOverscrollBehavior`, bound to the container's
   * pointerenter/pointerleave: while the pointer is inside the editor,
   * disable overscroll behavior to prevent panning from triggering
   * history back/forward on MacOS Chrome. Upstream binds the pair only while
   * interactive, which the gate here stands in for.
   */
  toggleOverscrollBehavior(event: PointerEvent) {
    if (!this.isInteractionEnabled()) {
      return;
    }
    document.documentElement.style.overscrollBehaviorX =
      event.type === "pointerenter" ? "none" : "auto";
  }

  /**
   * generally invoked only if fullscreen was invoked programmatically
   *
   * Upstream registers this from its edit-mode-only listener branch; caliburn
   * registers its document/window listeners once, as it does for the rest of
   * that branch (`onResize`, `onBlur`), and the handler's own guard is what
   * decides whether there is anything to clear.
   */
  private onFullscreenChange = () => {
    if (
      // points to the iframe element we fullscreened
      !document.fullscreenElement &&
      this.state.activeEmbeddable?.state === "active"
    ) {
      this.setState({
        activeEmbeddable: null,
      });
    }
  };

  ngAfterViewInit() {
    const staticCanvas = this.staticCanvasRef()?.nativeElement;
    if (staticCanvas) {
      this.rc = rough.canvas(staticCanvas);
    }
    const interactiveCanvas = this.interactiveCanvasRef()?.nativeElement;
    if (interactiveCanvas) {
      this.touchInput.start(interactiveCanvas);
    }
    const svgLayer = this.svgLayerRef()?.nativeElement;
    if (svgLayer) {
      this.lassoTrail.start(svgLayer);
      this.laserTrails.start(svgLayer);
      this.eraserTrail.start(svgLayer);
      this.drawShape.trail.start(svgLayer);
    }
    this.cursor.reset();
    this.updateDOMRect();
    this.observeContainerResize();
    this.initializeScene();
    // note that this check seems to always pass in localhost
    if (isBrave() && !isMeasureTextSupported()) {
      this.braveMeasureTextError.set(true);
    }
    if (this.autoFocus()) {
      this.focusContainer();
    }
    renderEditor(this);

    const mountPayload = {
      excalidrawAPI: this.getApi(),
      container: this.containerRef()?.nativeElement ?? null,
    };
    this._mounted = true;
    this.editorLifecycleEvents.emit("editor:mount", mountPayload);
    this.onMount()?.(mountPayload);
    this.maybeEmitInitialize();
  }

  /** upstream's `componentDidMount` observer, same `supportsResizeObserver`
   * guard — the container's own resizes (a docked sidebar, a host layout
   * change) never reach `window`'s `resize` */
  private observeContainerResize() {
    const container = this.containerRef()?.nativeElement;
    if (!supportsResizeObserver || !container) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.refreshEditorInterface();
      this.updateDOMRect();
    });
    this.resizeObserver.observe(container);
  }

  ngOnDestroy() {
    // upstream recreates the object so its `ExcalidrawAPIContext.Provider`
    // picks the new one up; caliburn has no such provider, so the throwing
    // getters and `isDestroyed` are only observable through
    // `h.app.getApi()` after destruction
    const api = this.getApi();
    this.api = { ...api, isDestroyed: true };
    for (const key of Object.keys(this.api) as (keyof typeof api)[]) {
      if (
        (key.startsWith("get") ||
          key === "onStateChange" ||
          key === "onEvent") &&
        typeof this.api[key] === "function"
      ) {
        (this.api as any)[key] = () => {
          throw new Error(
            "ExcalidrawAPI is no longer usable after the editor has been unmounted and will return invalid/empty data. You should check for `ExcalidrawAPI.isDestroyed` before calling get* methods on subscribing to state/event changes.",
          );
        };
      }
    }

    this.editorLifecycleEvents.emit("editor:unmount");
    this.onUnmount()?.();
    this.onExcalidrawAPI()?.(null);

    this.unmounted = true;
    this.lassoTrail.stop();
    this.laserTrails.stop();
    this.drawShape.stop();
    this.eraserTrail.stop();
    this.touchInput.stop();
    resetGesture();
    endPointerSession();
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener(
      "pointermove",
      this.updateCurrentCursorPosition,
    );
    document.removeEventListener("pointerup", this.removeDocumentPointer);
    document.removeEventListener(
      "gesturestart",
      this.onGestureStart as EventListener,
    );
    document.removeEventListener(
      "gesturechange",
      this.onGestureChange as EventListener,
    );
    document.removeEventListener(
      "gestureend",
      this.onGestureEnd as EventListener,
    );
    document.removeEventListener("paste", this.pasteFromClipboard);
    document.removeEventListener("copy", this.onCopy);
    document.removeEventListener("cut", this.onCut);
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("focus", this.onWindowFocus);
    window.removeEventListener("unload", this.onWindowUnload);
    window.removeEventListener("blur", this.onWindowBlur);
    window.removeEventListener("message", onWindowMessage);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.removeSceneUpdateListener?.();
    this.removeSceneUpdateListener = null;
    this.library.destroy();
    this.unsubLibraryItems();
    clearLibraryItemSvgCache();
    this.onChangeEmitter.clear();
    this.missingPointerEventCleanupEmitter.clear();
    this.store.onStoreIncrementEmitter.clear();
    this.store.onDurableIncrementEmitter.clear();
    this.appStateObserver.clear();
    this.editorLifecycleEvents.clear();
    this.scene.destroy();
  }

  private initializeScene() {
    this.sceneInitialized = true;
    const initialData = this.initialData();

    if (initialData?.libraryItems) {
      this.library
        .updateLibrary({
          libraryItems: initialData.libraryItems,
          merge: true,
        })
        .catch((error) => {
          console.error(error);
        });
    }

    const restoredElements = restoreElements(initialData?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    });
    let restoredAppState: Partial<AppState> = {
      ...this.state,
      ...(initialData?.appState || {}),
    };

    if (!restoredAppState.preferredSelectionTool?.initialized) {
      restoredAppState.preferredSelectionTool = {
        type:
          this.editorInterface.formFactor === "phone" ? "lasso" : "selection",
        initialized: true,
      };
    }

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

    // clear the shape and image cache so that any images in initialData
    // can be loaded fresh
    this.clearImageShapeCache();

    // manually loading the font faces seems faster even in browsers that do
    // fire the loadingdone event
    this.fonts.loadSceneFonts().then((fontFaces) => {
      this.fonts.onLoaded(fontFaces);
    });
  }

  /** upstream `App.clearImageShapeCache` — drops the cached bitmap and the
   * cached shape of every drawn image the supplied files cover, so the next
   * render picks the new file data up */
  private clearImageShapeCache(filesMap?: BinaryFiles) {
    const files = filesMap ?? this.files;
    this.scene.getNonDeletedElements().forEach((element) => {
      if (isInitializedImageElement(element) && files[element.fileId]) {
        this.imageCache.delete(element.fileId);
        ShapeCache.delete(element);
      }
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
    this.batchCommits(() => this.onKeyDownImpl(event));
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (!this.isInteractionEnabled()) {
      return;
    }
    if (event.key === KEYS.SPACE) {
      this.batchCommits(() => this.onSpaceKeyUp());
    }
    if (event.key === KEYS.ALT) {
      this.batchCommits(() => {
        this.bucketFill.closeTemporaryEyeDropper();
        maybeHandleArrowPointlikeDrag({ app: this as any, event });
      });
    }

    // upstream writes the orbit mode from here, where React's batching keeps
    // the new value out of reach of the rest of the handler — the
    // `maybeHandleArrowPointlikeDrag` below re-runs the drag under the mode
    // the key was released in (`binding.ts` reads it). Caliburn's writes
    // commit as they are made, so the write is queued here and published
    // where upstream's own flushes land it: the binding-preference
    // `flushSync` below, else the end of the handler.
    let restoreOrbitBindMode = false;

    if (
      (event.key === KEYS.ALT && this.state.bindMode === "skip") ||
      (!event[KEYS.CTRL_OR_CMD] && !isBindingEnabled(this.state))
    ) {
      // Handle Alt key release for bind mode
      restoreOrbitBindMode = true;

      // Restart the timer if we're creating/editing a linear element and hovering over an element
      if (this.lastPointerMoveEvent && getFeatureFlag("COMPLEX_BINDINGS")) {
        this.batchCommits(() => {
          const scenePointer = viewportCoordsToSceneCoords(
            {
              clientX: this.lastPointerMoveEvent!.clientX,
              clientY: this.lastPointerMoveEvent!.clientY,
            },
            this.state,
          );

          const hoveredElement = getHoveredElementForBinding(
            pointFrom<GlobalPoint>(scenePointer.x, scenePointer.y),
            this.scene.getNonDeletedElements(),
            this.scene.getNonDeletedElementsMap(),
          );

          if (this.state.selectedLinearElement) {
            const element = LinearElementEditor.getElement(
              this.state.selectedLinearElement.elementId,
              this.scene.getNonDeletedElementsMap(),
            );

            if (isBindingElement(element)) {
              this.delayedBindMode.handleDelayedBindModeChange(
                element,
                hoveredElement,
              );
            }
          }
        });
      }
    }

    // If Ctrl is not held, ensure isBindingEnabled reflects the user preference.
    if (!event[KEYS.CTRL_OR_CMD]) {
      const preferenceEnabled = this.state.bindingPreference === "enabled";
      if (this.state.isBindingEnabled !== preferenceEnabled) {
        this.batchCommits(() => {
          // upstream's `flushSync` here publishes everything queued so far,
          // the orbit write above included, so the drag below runs under it
          if (restoreOrbitBindMode) {
            restoreOrbitBindMode = false;
            this.setState({ bindMode: "orbit" });
          }

          this.setState({ isBindingEnabled: preferenceEnabled });

          this.arrowText.refresh();
        });
      }

      this.batchCommits(() =>
        maybeHandleArrowPointlikeDrag({ app: this as any, event }),
      );
    }

    if (isArrowKey(event.key)) {
      this.batchCommits(() => {
        bindOrUnbindBindingElements(
          this.scene.getSelectedElements(this.state).filter(isArrowElement),
          this.scene,
          this.state,
        );

        const elementsMap = this.scene.getNonDeletedElementsMap();

        this.scene
          .getSelectedElements(this.state)
          .filter(isSimpleArrow)
          .forEach((element) => {
            // Update the fixed point bindings for non-elbow arrows
            // when the pointer is released, so that they are correctly positioned
            // after the drag.
            if (element.startBinding) {
              this.scene.mutateElement(element, {
                startBinding: {
                  ...element.startBinding,
                  ...calculateFixedPointForNonElbowArrowBinding(
                    element,
                    elementsMap.get(
                      element.startBinding.elementId,
                    ) as NonDeleted<ExcalidrawBindableElement>,
                    "start",
                    elementsMap,
                  ),
                },
              });
            }
            if (element.endBinding) {
              this.scene.mutateElement(element, {
                endBinding: {
                  ...element.endBinding,
                  ...calculateFixedPointForNonElbowArrowBinding(
                    element,
                    elementsMap.get(
                      element.endBinding.elementId,
                    ) as NonDeleted<ExcalidrawBindableElement>,
                    "end",
                    elementsMap,
                  ),
                },
              });
            }
          });

        this.setState({ suggestedBinding: null });
      });
    }

    if (restoreOrbitBindMode) {
      this.batchCommits(() => {
        this.setState({
          bindMode: "orbit",
        });
      });
    }

    this.batchCommits(() => this.flowchart.handleKeyEvent(event));
  };

  private onSpaceKeyUp() {
    if (
      (this.state.viewModeEnabled && this.state.activeTool.type !== "laser") ||
      this.state.openDialog?.name === "elementLinkSelector"
    ) {
      this.cursor.set(CURSOR_TYPE.GRAB);
    } else if (isSelectionLikeTool(this.state.activeTool.type)) {
      this.cursor.reset();
    } else {
      this.cursor.applyForTool();
      this.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.state),
        selectedGroupIds: {},
        editingGroupId: null,
        activeEmbeddable: null,
      });
    }
    setHoldingSpace(false);
  }

  /**
   * The browser's own keyboard zoom is prevented over the non-interactive
   * editor by default (opt out via
   * `interaction: { enabled: { browserZoom: true } }`), mirroring the
   * interactive editor. Upstream attaches this as its own keydown listener
   * beside the navigation one, so both run on the same event.
   */
  private preventBrowserZoomKeyDown = (event: KeyboardEvent) => {
    if (
      event[KEYS.CTRL_OR_CMD] &&
      (event.code === CODES.EQUAL ||
        event.code === CODES.MINUS ||
        event.code === CODES.ZERO ||
        event.code === CODES.NUM_ADD ||
        event.code === CODES.NUM_SUBTRACT ||
        event.code === CODES.NUM_ZERO)
    ) {
      event.preventDefault();
    }
  };

  private onKeyDownImpl = (event: KeyboardEvent) => {
    if (!this.isInteractionEnabled()) {
      if (!this.isBrowserZoomEnabled()) {
        this.preventBrowserZoomKeyDown(event);
      }
      // only the navigation keyboard remains: page-scroll keys and
      // `navigation`-flagged action shortcuts (canvas zoom & zoom-to-fit —
      // see `ActionManager.handleKeyDown`'s own gates)
      if (
        this.isNavigationEnabled() &&
        this.maybeHandlePageScrollKeyDown(event)
      ) {
        // the editor consumes the input — the page must not scroll along
        event.preventDefault();
        return;
      }
      this.actionManager.handleKeyDown(event);
      return;
    }

    // normalize `event.key` when CapsLock is pressed #2372

    if (
      "Proxy" in window &&
      ((!event.shiftKey && /^[A-Z]$/.test(event.key)) ||
        (event.shiftKey && /^[a-z]$/.test(event.key)))
    ) {
      event = new Proxy(event, {
        get(ev: any, prop) {
          const value = ev[prop];
          if (typeof value === "function") {
            // fix for Proxies hijacking `this`
            return value.bind(ev);
          }
          return prop === "key"
            ? // CapsLock inverts capitalization based on ShiftKey, so invert
              // it back
              event.shiftKey
              ? ev.key.toUpperCase()
              : ev.key.toLowerCase()
            : value;
        },
      });
    }

    if (
      event[KEYS.CTRL_OR_CMD] &&
      event.key === KEYS.P &&
      !event.shiftKey &&
      !event.altKey
    ) {
      this.setToast({
        message: t("commandPalette.shortcutHint", {
          shortcut: getShortcutFromShortcutName("commandPalette"),
        }),
      });
      event.preventDefault();
      return;
    }

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

    if (
      (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
      this.state.croppingElementId
    ) {
      finishImageCropping(this);
      return;
    }

    const selectedElementsForCrop = this.scene.getSelectedElements(this.state);
    if (
      selectedElementsForCrop.length === 1 &&
      isImageElement(selectedElementsForCrop[0]) &&
      event.key === KEYS.ENTER
    ) {
      startImageCropping(this, selectedElementsForCrop[0]);
      return;
    }

    // upstream nests everything from the crop blocks above through the shape
    // switching below in a single `!isInputLike(event.target)` guard; the
    // `bail if` above already covers the crop paths, so only this block
    // still needs it
    if (!isInputLike(event.target)) {
      const selectedElements = this.scene.getSelectedElements(this.state);

      // Shape switching
      if (event.key === KEYS.ESCAPE) {
        this.convertElementTypePopup.set(null);
      } else if (
        event.key === KEYS.TAB &&
        (document.activeElement === this.containerRef()?.nativeElement ||
          document.activeElement?.classList.contains(
            CLASSES.CONVERT_ELEMENT_TYPE_POPUP,
          ))
      ) {
        event.preventDefault();

        const conversionType = getConversionTypeFromElements(selectedElements);

        if (this.convertElementTypePopup()?.type === "panel") {
          if (
            convertElementTypes(this, {
              conversionType,
              direction: event.shiftKey ? "left" : "right",
            })
          ) {
            this.store.scheduleCapture();
          }
        }
        if (conversionType) {
          this.convertElementTypePopup.set({
            type: "panel",
          });
        }
      }

      if (this.flowchart.handleKeyEvent(event)) {
        return;
      }
    }

    if (this.maybeHandlePageScrollKeyDown(event)) {
      // the editor consumes the input — the page must not scroll along
      event.preventDefault();
      return;
    }

    // Handle Alt key for bind mode
    if (event.key === KEYS.ALT) {
      if (this.state.activeTool.type === "bucketfill") {
        this.bucketFill.openTemporaryEyeDropper();
        event.preventDefault();
        return;
      } else if (getFeatureFlag("COMPLEX_BINDINGS")) {
        this.delayedBindMode.handleSkipBindMode();
      } else {
        maybeHandleArrowPointlikeDrag({ app: this as any, event });
      }
    }

    if (this.actionManager.handleKeyDown(event)) {
      return;
    }

    if (this.state.viewModeEnabled && event.key === KEYS.ESCAPE) {
      this.setActiveTool({ type: "selection" });
      return;
    }

    if (
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !this.state.newElement &&
      !this.state.selectionElement &&
      !this.state.selectedElementsAreBeingDragged
    ) {
      const shape = findShapeByKey(event.key, this as any, event.shiftKey);

      if (this.state.viewModeEnabled && shape !== "laser" && shape !== "hand") {
        return;
      }

      if (shape) {
        if (shape === "arrow" && this.state.activeTool.type === "arrow") {
          const nextArrowType =
            this.state.currentItemArrowType === ARROW_TYPE.sharp
              ? ARROW_TYPE.round
              : this.state.currentItemArrowType === ARROW_TYPE.round
              ? ARROW_TYPE.elbow
              : ARROW_TYPE.sharp;
          this.setState({ currentItemArrowType: nextArrowType });
          this.cursorHints.onArrowTypeCycled(nextArrowType);
        } else {
          if (shape === "arrow" || shape === "line") {
            this.cursorHints.onToolShortcut(
              shape,
              /^\d$/.test(event.key) ? "digit" : "letter",
            );
          }

          if (
            shape === "bucketfill" &&
            this.state.activeTool.type === "bucketfill"
          ) {
            this.bucketFill.cycleBackgroundColor();
          } else if (
            shape === "lasso" &&
            this.state.activeTool.type === "laser"
          ) {
            this.setActiveTool({
              type: this.state.preferredSelectionTool.type,
            });
          } else {
            this.setActiveTool({ type: shape }, { toggle: true });
          }
        }

        event.stopPropagation();

        return;
      } else if (event.key === KEYS.Q) {
        this.toggleToolLock();
        event.stopPropagation();
        return;
      }
    }

    if (this.state.viewModeEnabled) {
      return;
    }

    if (event[KEYS.CTRL_OR_CMD] && !event.repeat) {
      if (getFeatureFlag("COMPLEX_BINDINGS")) {
        this.delayedBindMode.resetDelayedBindMode();
      }

      this.setState({
        isBindingEnabled: this.state.bindingPreference !== "enabled",
      });

      // the toggle changes what a text-tool click at the current position
      // would do, with no pointermove to refresh the affordance
      this.arrowText.refresh();

      maybeHandleArrowPointlikeDrag({ app: this as any, event });
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

    if (event.key === KEYS.SPACE && gesture.pointers.size === 0) {
      setHoldingSpace(true);
      this.cursor.set(CURSOR_TYPE.GRAB);
      event.preventDefault();
    }

    if (
      (event.key === KEYS.G || event.key === KEYS.S) &&
      !event.altKey &&
      !event[KEYS.CTRL_OR_CMD]
    ) {
      const selectedElements = this.scene.getSelectedElements(this.state);
      if (
        this.state.activeTool.type === "selection" &&
        !selectedElements.length
      ) {
        return;
      }

      if (
        event.key === KEYS.G &&
        (hasBackground(this.state.activeTool.type) ||
          selectedElements.some((element) => hasBackground(element.type)))
      ) {
        this.setState({ openPopup: "elementBackground" });
        event.stopPropagation();
      }
      if (event.key === KEYS.S) {
        this.setState({ openPopup: "elementStroke" });
        event.stopPropagation();
      }
    }

    if (
      !event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      event.key.toLowerCase() === KEYS.F
    ) {
      const selectedElements = this.scene.getSelectedElements(this.state);

      if (
        this.state.activeTool.type === "selection" &&
        !selectedElements.length
      ) {
        return;
      }

      if (
        this.state.activeTool.type === "text" ||
        selectedElements.find(
          (element) =>
            isTextElement(element) ||
            getBoundTextElement(element, this.scene.getNonDeletedElementsMap()),
        )
      ) {
        event.preventDefault();
        this.setState({ openPopup: "fontFamily" });
      }
    }

    if (
      event[KEYS.CTRL_OR_CMD] &&
      (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE)
    ) {
      this.activeConfirmDialog.set("clearCanvas");
      // the document keydown listener runs outside Angular, and this dialog
      // lives in a signal rather than in appState — there is no commit for
      // the refresh to ride along with, so flush the views here
      this.cdr.detectChanges();
    }

    // eye dropper
    // -----------------------------------------------------------------------
    const lowerCased = event.key.toLocaleLowerCase();
    const isPickingStroke =
      lowerCased === KEYS.S && event.shiftKey && !event[KEYS.CTRL_OR_CMD];
    const isPickingBackground =
      event.key === KEYS.I || (lowerCased === KEYS.G && event.shiftKey);

    if (isPickingStroke || isPickingBackground) {
      this.openEyeDropper({
        type: isPickingStroke ? "stroke" : "background",
      });
    }
    // -----------------------------------------------------------------------
  };

  private openEyeDropper = ({ type }: { type: "stroke" | "background" }) => {
    this.activeEyeDropper.set({
      swapPreviewOnAlt: true,
      colorPickerType:
        type === "stroke" ? "elementStroke" : "elementBackground",
      onSelect: (color, event) => {
        const shouldUpdateStrokeColor =
          (type === "background" && event.altKey) ||
          (type === "stroke" && !event.altKey);
        const selectedElements = this.scene.getSelectedElements(this.state);
        if (
          !selectedElements.length ||
          this.state.activeTool.type !== "selection"
        ) {
          if (shouldUpdateStrokeColor) {
            this.syncActionResult({
              appState: { ...this.state, currentItemStrokeColor: color },
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          } else {
            this.syncActionResult({
              appState: { ...this.state, currentItemBackgroundColor: color },
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        } else {
          this.updateScene({
            elements: this.scene.getElementsIncludingDeleted().map((el) => {
              if (this.state.selectedElementIds[el.id]) {
                return newElementWith(el, {
                  [shouldUpdateStrokeColor ? "strokeColor" : "backgroundColor"]:
                    color,
                });
              }
              return el;
            }),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
        }
      },
      keepOpenOnAlt: false,
    });
    this.cdr.detectChanges();
  };

  handleWheel = (event: WheelEvent) => {
    // NOTE no preventDefault so the page can scroll over the editor
    if (!this.isNavigationEnabled()) {
      if (
        !this.isInteractionEnabled() &&
        !this.isBrowserZoomEnabled() &&
        event[KEYS.CTRL_OR_CMD]
      ) {
        // the browser's own zoom is prevented over the editor by default,
        // mirroring the interactive editor (opt out via
        // `interaction: { enabled: { browserZoom: true } }`); trackpad
        // pinch is delivered as ctrl+wheel
        event.preventDefault();
      }
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
    if (typeof state === "function" && this.pendingSelectionClear) {
      // React runs a queued updater against the state the updates before it
      // have already produced, so an updater queued after the pending clear
      // reads a cleared selection. Apply it before the updater runs.
      this.applyPendingSelectionClear();
    }
    const prevState = this.state;
    const partial = typeof state === "function" ? state(this.state) : state;
    if (partial) {
      if (this.pendingSelectionClear && "selectedElementIds" in partial) {
        // an object-form write was computed from the pre-clear selection and
        // is queued behind the clear, so it wins outright
        this.pendingSelectionClear = false;
      }
      if (
        this.pendingIsBindingEnabledRestore &&
        "isBindingEnabled" in partial
      ) {
        // same rule for the queued binding-preference restore
        this.pendingIsBindingEnabledRestore = false;
      }
      this.state = { ...this.state, ...partial };
    }
    this.applyStateInvariants();
    this.commit();
    if (
      Object.keys(this.state.selectedElementIds).length &&
      isEraserActive(this.state)
    ) {
      if (this.activeTool()) {
        // A host-controlled eraser cannot be switched away from. Upstream
        // arrives at this state through `handleForcedToolChange` →
        // `setActiveTool`, whose non-selection branch clears the selection,
        // so it settles on the eraser with nothing selected. Caliburn's
        // `applyStateInvariants` restores a forced tool by direct assignment
        // and so skips that reset — and this `setState` is synchronous and
        // re-entrant, so switching to the selection tool here would recurse
        // without bound. Clearing exactly what `setActiveTool` clears reaches
        // upstream's end state and terminates on the next evaluation.
        this.setState((prevState) => ({
          selectedElementIds: makeNextSelectedElementIds({}, prevState),
          selectedGroupIds: makeNextSelectedElementIds({}, prevState),
          editingGroupId: null,
          multiElement: null,
        }));
      } else {
        this.setState({
          activeTool: updateActiveTool(this.state, { type: "selection" }),
        });
      }
    }
    if (
      this.state.activeTool.type === "eraser" &&
      prevState.theme !== this.state.theme
    ) {
      this.cursor.applyForTool();
    }
    if (
      this.state.activeTool.type === "bucketfill" &&
      prevState.currentItemBackgroundColor !==
        this.state.currentItemBackgroundColor
    ) {
      this.cursor.applyForTool();
    }
    if (isEraserActive(prevState) && !isEraserActive(this.state)) {
      this.eraserTrail.endPath();
    }
    if (prevState.viewModeEnabled !== this.state.viewModeEnabled) {
      this.cursor.reset();
      // textWysiwyg's and frame-name's submit paths run through setState.
      // Defer until after the current update, then submit whichever editing
      // session is active if editing is still disabled.
      queueMicrotask(() => {
        if (this.state.viewModeEnabled) {
          this.textWysiwygSubmitHandler?.();
          if (this.state.editingFrame) {
            const frame = this.scene.getNonDeletedElement(
              this.state.editingFrame,
            );
            resetEditingFrame(
              this,
              frame && isFrameLikeElement(frame) ? frame : null,
            );
          }
        }
      });
    }
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
    // batched state and scene writes render once, when the batch ends — the
    // intermediate views React's batching never produces must not be produced
    // here either. The two deliberate exceptions are the signal-only flushes in
    // `onKeyDownImpl` (the clear-canvas dialog) and `openEyeDropper`, which
    // write no app state and so have no commit to ride along with.
    if (this.batchDepth === 0) {
      this.cdr.detectChanges();
    }
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

  /**
   * Whether the tool can be activated & driven by user input. False when
   * disabled via `UIOptions.tools`, or when the editor is non-interactive
   * and the tool isn't kept user-driven via `interaction.enabled.tools`.
   */
  isToolSupported = <T extends ToolType | "custom">(
    tool: T,
    props?: InteractionProps,
  ): boolean => {
    const UIOptions = this.props.UIOptions as {
      tools?: Record<string, boolean>;
    };
    if (UIOptions.tools?.[tool] === false) {
      return false;
    }
    if (this.isInteractionEnabled(props)) {
      return true;
    }
    const interaction = this.interactionOf(props);
    const tools =
      typeof interaction === "object" ? interaction.enabled?.tools : undefined;
    if (tool === "laser") {
      return tools?.laser === true;
    }
    if (tool === "custom") {
      return tools?.custom === true;
    }
    return false;
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
    // upstream's `setActiveTool` is a single React update: its two `setState`
    // calls are batched into one render, so the intermediate state — the tool
    // that is about to be replaced, with the reset already applied — is never
    // rendered. Caliburn's `setState` renders synchronously, so the batch is
    // what keeps that state off screen; the grouped-tool popover reads a
    // render of it as "the active tool left my group" and closes itself
    this.batchCommits(() => this.setActiveToolImpl(tool, opts));
  };

  private setActiveToolImpl(
    tool: Parameters<CaliburnEditorComponent["setActiveTool"]>[0],
    opts: NonNullable<Parameters<CaliburnEditorComponent["setActiveTool"]>[1]>,
  ) {
    const { keepSelection = false } = opts;

    if (!this.isToolSupported(tool.type)) {
      console.warn(
        this.isInteractionEnabled()
          ? `"${tool.type}" tool is disabled via "UIOptions.canvasActions.tools.${tool.type}"`
          : `"${tool.type}" tool cannot be activated while the editor is non-interactive (see "interaction.enabled.tools")`,
      );
      return;
    }

    const forcedTool = this.activeTool();
    if (forcedTool && !this.isSameForcedTool(forcedTool, tool)) {
      console.warn(
        `"${tool.type}" tool activation ignored — the active tool is controlled by the host via "props.activeTool"`,
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

    if (nextActiveTool.type === "hand") {
      this.cursor.set(CURSOR_TYPE.GRAB);
    } else if (!isHoldingSpace()) {
      this.cursor.applyForTool(nextActiveTool);
    }

    if (isToolIcon(document.activeElement)) {
      this.focusContainer();
    }

    if (!isLinearElementType(nextActiveTool.type)) {
      this.setState({ suggestedBinding: null });
    }

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
  }

  setToast = (toast: AppState["toast"]) => {
    this.setState({ toast });
  };

  toggleToolLock() {
    if (this.activeTool()) {
      // the active tool — including its lock state — is host-controlled
      return;
    }
    this.setState({
      activeTool: {
        ...this.state.activeTool,
        locked: !this.state.activeTool.locked,
      },
    });
  }

  /** the head of upstream's per-tool-button `onSelect` (`Tools.tsx`), shared
   * by the two toolbars that port that one handler between them */
  detectPenOnToolSelect(pointerType: PointerType | null) {
    if (!this.state.penDetected && pointerType === "pen") {
      this.togglePenMode(true);
    }
  }

  togglePenMode(force: boolean | null) {
    this.setState((prevState) => {
      return {
        penMode: force ?? !prevState.penMode,
        penDetected: true,
        currentItemStrokeVariability: !prevState.penDetected
          ? "variable"
          : prevState.currentItemStrokeVariability,
      };
    });
  }

  /**
   * The tool revert's own `setState`, with upstream's post-revert cursor
   * reset as its callback ("reset once the tool revert has settled",
   * `App.tsx`). Upstream reverts from a single place per interaction;
   * caliburn's pointer-up fans out into per-branch finalizers that each carry
   * a copy of the revert, so the callback lives here — the one place they all
   * go through — rather than in each of them.
   */
  setStateRevertingActiveTool = (state: SetStateArg) => {
    this.setState(state, () => this.cursor.reset());
  };

  clearSelection(hitElement?: ExcalidrawElement | null) {
    // upstream reads this off the pre-update state, which React only settles
    // once the handler returns
    const previousSelectedElementIds = this.state.selectedElementIds;
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
      previousSelectedElementIds,
      selectedLinearElement: null,
    });
  }

  /** upstream `App.tsx`'s `dismissLinearEditor`, which `changeArrowType`
   * calls when it turns an arrow elbowed */
  dismissLinearEditor = () => {
    setTimeout(() => {
      if (this.state.selectedLinearElement?.isEditing) {
        this.setState({
          selectedLinearElement: {
            ...this.state.selectedLinearElement,
            isEditing: false,
          },
        });
      }
    });
  };

  applyDeltas = (
    deltas: StoreDelta[],
    options?: ApplyToOptions,
  ): [SceneElementsMap, AppState, boolean] => {
    // squash all deltas together, starting with a fresh new delta instance
    const aggregatedDelta = StoreDelta.squash(...deltas);

    // create new instance of elements map & appState, so we don't accidentaly mutate existing ones
    const nextAppState = { ...this.state };
    const nextElements = new Map(
      this.scene.getElementsMapIncludingDeleted(),
    ) as SceneElementsMap;

    return StoreDelta.applyTo(
      aggregatedDelta,
      nextElements,
      nextAppState,
      options,
    );
  };

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
      this.laserTrails.updateCollabTrails(collaborators);
      this.setState({ collaborators });
    }
  };

  handleCanvasPanUsingWheelOrSpaceDrag = (event: PointerEvent | MouseEvent) =>
    panCanvasOnWheelOrSpaceDrag(this, event as PointerEvent);

  /**
   * Upstream's `handleCanvasClick` (`App.tsx`): keeps the last two completed
   * canvas clicks so `shouldHandleBrowserCanvasDoubleClick` can tell a real
   * double click from two clicks that drifted apart.
   */
  handleCanvasClick(event: MouseEvent) {
    if (!this.isInteractionEnabled()) {
      return;
    }
    if (event.button !== POINTER_BUTTON.MAIN) {
      this.lastCompletedCanvasClicks = [];
      return;
    }

    this.lastCompletedCanvasClicks = [
      ...this.lastCompletedCanvasClicks.slice(-1),
      {
        x: event.clientX,
        y: event.clientY,
      },
    ];
  }

  handleCanvasDoubleClick(event: CanvasDoubleClickEvent) {
    this.batchCommits(() => handleCanvasDoubleClick(this, event));
  }

  handleCanvasContextMenu(event: MouseEvent) {
    this.batchCommits(() => handleCanvasContextMenu(this, event));
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
    this.batchCommits(() => {
      try {
        this.handleCanvasPointerDownImpl(event);
      } finally {
        // both are writes upstream has already queued by the time the
        // dispatch below them runs, so a dispatch that throws must not
        // swallow them
        this.applyPendingSelectionClear();
        this.applyPendingIsBindingEnabledRestore();
      }
    });
  }

  /**
   * Upstream's "if Ctrl is not held, ensure `isBindingEnabled` reflects the
   * user preference" reset, queued near the top of the pointer down & up
   * handlers and applied where React's own queue would let it land. Upstream
   * writes it as a plain `setState` — unlike the ctrl toggle itself, which it
   * wraps in `flushSync` — so the restored value only lands once the handler
   * has returned, and the in-flight event still sees the binding state the
   * pointer went down with.
   *
   * The same per-write-form rule `armClearSelectionIfNotUsingSelection`
   * carries applies: an OBJECT-form write of `isBindingEnabled` queued after
   * it wins outright. The only such write is the ctrl toggle in
   * `handleLinearElementOnPointerDown`, and ctrl decides both — the toggle
   * only runs when this arm did not — so the rule is held rather than
   * exercised. The clear's third arm (a FUNCTIONAL updater queued after it
   * forces it to land first) has no counterpart: no updater reads
   * `isBindingEnabled`, and landing it early would show the handler's own
   * `isBindingEnabled(this.state)` reads a value React still hides from them.
   */
  private armRestoreIsBindingEnabledToPreference(event: PointerEvent) {
    this.pendingIsBindingEnabledRestore = !event.ctrlKey;
  }

  private applyPendingIsBindingEnabledRestore() {
    if (!this.pendingIsBindingEnabledRestore) {
      return;
    }
    this.pendingIsBindingEnabledRestore = false;
    const preferenceEnabled = this.state.bindingPreference === "enabled";
    if (this.state.isBindingEnabled !== preferenceEnabled) {
      this.setState({ isBindingEnabled: preferenceEnabled });
    }
  }

  private handleCanvasPointerDownImpl(event: PointerEvent) {
    if (
      !this.isInteractionEnabled() &&
      !this.isToolSupported(this.state.activeTool.type)
    ) {
      if (this.isLinksEnabled() || this.isEmbedsEnabled()) {
        // needed by handleElementLinkClick & handleIframeLikeCenterClick
        // (drag-distance & hit checks)
        this.lastPointerDownEvent = event;
      }
      if (this.isNavigationEnabled()) {
        updateGestureOnPointerDown(this, event);
        // pans on drag same as view mode (the pan session manages its own
        // window listeners & teardown)
        this.handleCanvasPanUsingWheelOrSpaceDrag(event);
      }
      return;
    }
    // with the active tool allowed via `interaction.enabled.tools`, the
    // pointer keeps driving it through the full flow below — safe while
    // non-interactive because that implies view mode, whose gates constrain
    // everything except the tool-usage path

    // If Ctrl is not held, ensure isBindingEnabled reflects the user preference.
    this.armRestoreIsBindingEnabledToPreference(event);

    const target = event.target as HTMLElement;
    // capture subsequent pointer events to the canvas
    // this makes other elements non-interactive until pointer up
    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }

    // the second-finger block below reads the stroke this press interrupts.
    // Upstream reads it off `this.state` there, and still sees it: its
    // `setState` is asynchronous, so the pointer-up the cleanup below replays
    // has not cleared `newElement` yet. Caliburn's is synchronous, so the
    // stroke is read here, before the replay ends it.
    const newElementOnPointerDown = this.state.newElement;

    this.maybeCleanupAfterMissingPointerUp(event);

    // laser pointer is a presentation aid, not an edit — using it while
    // following someone shouldn't break follow
    if (this.state.activeTool.type !== "laser") {
      this.requestUnfollow();
    }

    this.lastPointerMoveCoords = viewportCoordsToSceneCoords(event, this.state);

    if (this.state.searchMatches) {
      this.setState((state) => {
        return {
          searchMatches: state.searchMatches && {
            focusedId: null,
            matches: state.searchMatches.matches.map((searchMatch) => ({
              ...searchMatch,
              focus: false,
            })),
          },
        };
      });
      this.searchItemInFocus.set(null);
    }

    if (this.convertElementTypePopup()) {
      this.convertElementTypePopup.set(null);
    }

    // since contextMenu options are potentially evaluated on each render,
    // and an contextMenu action may depend on selection state, we must
    // close the contextMenu before we update the selection on pointerDown
    // (e.g. resetting selection)
    if (this.state.contextMenu) {
      this.setState({ contextMenu: null });
    }

    if (this.state.openPopup) {
      this.setState({ openPopup: null });
    }

    updateGestureOnPointerDown(this, event);

    // if dragging element is freedraw and another pointerdown event occurs
    // a second finger is on the screen
    // discard the freedraw element if it is very short because it is likely
    // just a spike, otherwise finalize the freedraw element when the second
    // finger is lifted
    if (
      event.pointerType === "touch" &&
      newElementOnPointerDown &&
      newElementOnPointerDown.type === "freedraw"
    ) {
      const element = newElementOnPointerDown as ExcalidrawFreeDrawElement;
      this.updateScene({
        ...(element.points.length < 10
          ? {
              elements: this.scene
                .getElementsIncludingDeleted()
                .filter((el) => el.id !== element.id),
            }
          : {}),
        appState: {
          newElement: null,
          editingTextElement: null,
          suggestedBinding: null,
          selectedElementIds: makeNextSelectedElementIds(
            Object.keys(this.state.selectedElementIds)
              .filter((key) => key !== element.id)
              .reduce((obj: { [id: string]: true }, key) => {
                obj[key] = this.state.selectedElementIds[key];
                return obj;
              }, {}),
            this.state,
          ),
        },
        captureUpdate:
          this.state.openDialog?.name === "elementLinkSelector"
            ? CaptureUpdateAction.EVENTUALLY
            : CaptureUpdateAction.NEVER,
      });
      return;
    }

    // remove any active selection when we start to interact with canvas
    // (mainly, we care about removing selection outside the component which
    //  would prevent our copy handling otherwise)
    const selection = document.getSelection();
    if (selection?.anchorNode) {
      selection.removeAllRanges();
    }
    this.touchInput.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event);

    //fires only once, if pen is detected, penMode is enabled
    //the user can disable this by toggling the penMode button
    if (!this.state.penDetected && event.pointerType === "pen") {
      this.setState(() => {
        return {
          penMode: true,
          penDetected: true,
          currentItemStrokeVariability: "variable",
        };
      });
    }

    // upstream latches this the first time a pen or a finger touches the
    // canvas (`App.tsx`), before its own panning early return — the pointer
    // type is all it looks at
    if (
      !this.editorInterfaceSignal().isTouchScreen &&
      ["pen", "touch"].includes(event.pointerType)
    ) {
      this.editorInterfaceSignal.set(
        updateObject(this.editorInterfaceSignal(), { isTouchScreen: true }),
      );
    }

    this.lastPointerDownEvent = event;

    if (this.handleCanvasPanUsingWheelOrSpaceDrag(event)) {
      return;
    }

    // upstream registers the pointer with the gesture before this, so
    // `pointersMap` already carries it when the broadcast reads it
    this.setState({
      lastPointerDownWith: event.pointerType as AppState["lastPointerDownWith"],
      cursorButton: "down",
    });
    this.savePointer(event.clientX, event.clientY, "down");

    if (
      event.button === POINTER_BUTTON.ERASER &&
      // must not switch tools while non-interactive (reachable when the
      // active tool is allowed via `interaction.enabled.tools`) or while
      // the active tool is host-controlled
      this.isInteractionEnabled() &&
      !this.activeTool() &&
      this.state.activeTool.type !== TOOL_TYPE.eraser
    ) {
      // upstream re-enters the handler from a `setState` callback, so the
      // eraser is active by the time the second pass reads it; here the
      // write lands before the call returns, so the two run in sequence
      this.setState({
        activeTool: updateActiveTool(this.state, {
          type: TOOL_TYPE.eraser,
          lastActiveTool: this.state.activeTool,
        }),
      });
      if (!isEraserActive(this.state)) {
        // the eraser guard sends a tool that meets a selection straight back
        // to selection. Upstream's callback still sees the eraser because the
        // revert only lands on the next render, so it re-enters once and the
        // tool is back on selection by the time anything is erased; here the
        // revert is already in `this.state`, so re-entering would take this
        // same branch again, without bound. Stopping at upstream's end state.
        return;
      }
      this.handleCanvasPointerDown(event);
      const onPointerUp = () => {
        unsubPointerUp();
        unsubCleanup?.();
        if (isEraserActive(this.state)) {
          this.setState({
            activeTool: updateActiveTool(this.state, {
              ...(this.state.activeTool.lastActiveTool || {
                type: TOOL_TYPE.selection,
              }),
              lastActiveTool: null,
            }),
          });
        }
      };

      const unsubPointerUp = addEventListener(
        window,
        EVENT.POINTER_UP,
        onPointerUp,
        {
          once: true,
        },
      );
      let unsubCleanup: UnsubscribeCallback | undefined;
      // subscribe inside rAF lest it'd be triggered on the same pointerdown
      // if we start erasing while coming from blurred document since
      // we cleanup pointer events on focus
      requestAnimationFrame(() => {
        unsubCleanup = this.missingPointerEventCleanupEmitter.once(onPointerUp);
      });
      return;
    }

    // only handle left mouse button or touch
    if (
      event.button !== POINTER_BUTTON.MAIN &&
      event.button !== POINTER_BUTTON.TOUCH &&
      event.button !== POINTER_BUTTON.ERASER
    ) {
      return;
    }

    // don't select while panning
    if (gesture.pointers.size > 1) {
      return;
    }

    this.setState({
      selectedElementsAreBeingDragged: false,
    });

    // upstream reads the origin off the pointer-down state it builds here for
    // every tool; caliburn builds it inside the per-tool dispatch below, and
    // the origin is that state's own `viewportCoordsToSceneCoords`
    if (
      this.handleTextAutoResizeHandlePointerDown(
        this.scene.getSelectedElements(this.state),
        viewportCoordsToSceneCoords(event, this.state),
      )
    ) {
      return;
    }

    if (handleDraggingScrollBar(this, event)) {
      return;
    }

    this.armClearSelectionIfNotUsingSelection();

    const activeToolType = this.state.activeTool.type;

    // in pen mode a finger neither draws nor erases — only the tools that
    // stay usable by touch do anything. Upstream places this between its
    // selection handling and the per-tool dispatch; caliburn runs the
    // selection handling from inside the dispatch's first arm, and the guard
    // lets selection and lasso through anyway, so it sits just ahead of it.
    const allowOnPointerDown =
      !this.state.penMode ||
      event.pointerType !== "touch" ||
      activeToolType === "selection" ||
      activeToolType === "lasso" ||
      activeToolType === "text" ||
      activeToolType === "image";

    if (!allowOnPointerDown) {
      return;
    }

    if (activeToolType === "selection" || activeToolType === "lasso") {
      this.pointerDownState = handleSelectionPointerDown(this, event);
      if (!this.pointerDownState) {
        // the pointer hit an element's link icon, or added a point to the
        // linear element being edited — no gesture starts
        return;
      }
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
    } else if (
      activeToolType === TOOL_TYPE.frame ||
      activeToolType === TOOL_TYPE.magicframe
    ) {
      this.pointerDownState = initialPointerDownState(this, event);
      createFrameElementOnPointerDown(
        this,
        this.pointerDownState,
        activeToolType,
      );
    } else if (activeToolType === "laser") {
      this.pointerDownState = initialPointerDownState(this, event);
      this.laserTrails.startPath(
        this.pointerDownState.lastCoords.x,
        this.pointerDownState.lastCoords.y,
      );
    } else if (activeToolType === "eraser") {
      // upstream creates the pointer-down state for every tool and only
      // excludes the eraser from `createGenericElementOnPointerDown`; the
      // trail's own `startPath` comes further down, after the public
      // pointer-down callbacks, where upstream has it
      this.pointerDownState = initialPointerDownState(this, event);
    } else if (activeToolType === "autoshape") {
      this.pointerDownState = initialPointerDownState(this, event);
      this.drawShape.handlePointerDown(this.pointerDownState);
    } else if (activeToolType === "bucketfill") {
      // one-shot click tool: pointer down only ARMS the fill — it commits in
      // the shared pointer-up teardown, and only when the interaction stayed
      // a single-pointer click (a second finger, a context menu, or a
      // pointercancel aborts it). Dispatched like any other tool so the
      // shared pointer lifecycle below — public onPointerDown/onPointerUp
      // callbacks, pointer-up teardown — runs for bucket clicks too. In view
      // mode this branch is unreachable:
      // `handleCanvasPanUsingWheelOrSpaceDrag` swallows the pointer-down.
      this.pointerDownState = initialPointerDownState(this, event);
      this.bucketFill.handlePointerDown(
        viewportCoordsToSceneCoords(event, this.state),
      );
    } else if (activeToolType === "custom") {
      this.pointerDownState = initialPointerDownState(this, event);
    }

    if (this.pointerDownState) {
      this.onPointerDown()?.(
        this.state.activeTool,
        this.pointerDownState,
        event,
      );
      this.onPointerDownEmitter.trigger(
        this.state.activeTool,
        this.pointerDownState,
        event,
      );
    }

    if (this.pointerDownState && this.state.activeTool.type === "eraser") {
      this.eraserTrail.startPath(
        this.pointerDownState.lastCoords.x,
        this.pointerDownState.lastCoords.y,
      );
    }

    if (!this.state.viewModeEnabled || this.isActiveToolPointerCapturing()) {
      startPointerSession(this, event);
    }
  }

  handleCanvasPointerMove(event: PointerEvent) {
    markCanvasHandledPointerEvent(event);
    this.batchCommits(() => this.handleCanvasPointerMoveImpl(event));
  }

  /**
   * The in-flight gesture's own move handling — upstream's
   * `onPointerMoveFromPointerDownHandler`, which runs off the window-level
   * listeners the gesture installs, so a drag that leaves the canvas keeps
   * going (`pointer-session.ts`). Everything the canvas binding does
   * regardless of a gesture (broadcasting the pointer, the viewport's last
   * position, the multi-touch gesture, hover affordances) stays out of it,
   * as upstream splits them.
   */
  handlePointerMoveFromPointerDown(event: PointerEvent) {
    this.batchCommits(() => this.onPointerMoveFromPointerDown(event));
  }

  /**
   * The in-flight gesture's own keyboard handling — upstream's
   * `onKeyDownFromPointerDownHandler` / `onKeyUpFromPointerDownHandler`
   * (`App.tsx`), installed on window beside the gesture's move & up handlers
   * (`pointer-session.ts`). Pressing or releasing alt/shift re-runs the
   * resize and the new-element drag against the pointer's last coords, so
   * the aspect lock (and resize-from-centre) takes effect on the key alone,
   * without waiting for a move.
   */
  handleKeyDownFromPointerDown(event: KeyboardEvent) {
    this.batchCommits(() => this.onKeyFromPointerDown(event));
  }

  handleKeyUpFromPointerDown(event: KeyboardEvent) {
    // Prevents focus from escaping excalidraw tab
    if (event.key === KEYS.ALT) {
      event.preventDefault();
    }
    this.batchCommits(() => this.onKeyFromPointerDown(event));
  }

  private onKeyFromPointerDown(event: KeyboardEvent) {
    const pointerDownState = this.pointerDownState;
    if (!pointerDownState) {
      return;
    }
    if (maybeHandleResize(this, pointerDownState, event)) {
      return;
    }
    maybeDragNewGenericElement(this, pointerDownState, event);
  }

  private onPointerMoveFromPointerDown(event: PointerEvent) {
    const pointerDownState = this.pointerDownState;
    if (!pointerDownState || !(event.target instanceof HTMLElement)) {
      return;
    }
    // ahead of the scene-coords write below, which upstream's own handler
    // does not reach before this point: the scrollbar drag keeps its running
    // position in `lastCoords` as CLIENT coords
    if (handlePointerMoveOverScrollbars(this, event, pointerDownState)) {
      return;
    }
    pointerDownState.lastCoords = viewportCoordsToSceneCoords(
      event,
      this.state,
    );
    const lastPointerCoords =
      this.previousPointerMoveCoords ?? pointerDownState.origin;
    this.previousPointerMoveCoords = pointerDownState.lastCoords;
    if (isEraserActive(this.state)) {
      handleEraser(this, event, pointerDownState.lastCoords);
      return;
    }
    if (this.state.activeTool.type === "laser") {
      this.laserTrails.addPointToPath(
        pointerDownState.lastCoords.x,
        pointerDownState.lastCoords.y,
      );
    }
    if (this.drawShape.handlePointerMove(pointerDownState.lastCoords)) {
      return;
    }
    if (maybeDragFreeDrawElement(this, pointerDownState, event)) {
      return;
    }
    if (maybeDragLinearPoint(this, pointerDownState, event)) {
      return;
    }
    if (this.state.newElement) {
      pointerDownState.drag.hasOccurred = true;
      maybeDragNewElement(this, pointerDownState, event);
    } else {
      handleSelectionPointerMove(
        this,
        pointerDownState,
        event,
        lastPointerCoords,
      );
    }
  }

  private handleCanvasPointerMoveImpl(event: PointerEvent) {
    if (!this.isInteractionEnabled()) {
      if (this.isToolSupported(this.state.activeTool.type)) {
        // keep broadcasting the pointer (`props.onPointerUpdate`) between
        // strokes of the enabled tool, so e.g. a presenter's cursor stays
        // visible to collaborators while the laser isn't drawing
        this.savePointer(event.clientX, event.clientY, this.state.cursorButton);
      }
      if (this.isNavigationEnabled()) {
        // two-finger pinch zoom/pan (single-pointer panning is handled by
        // the pan session set up on pointerdown)
        updateMultiTouchGesture(this, event);
      }
      if (
        (this.isLinksEnabled() || this.isEmbedsEnabled()) &&
        !isPanSessionActive()
      ) {
        this.handleInteractiveContentPointerMove(event);
      }
      return;
    }

    this.savePointer(event.clientX, event.clientY, this.state.cursorButton);
    this.lastPointerMoveEvent = event;

    const scenePointer = viewportCoordsToSceneCoords(event, this.state);
    this.lastPointerMoveCoords = {
      x: scenePointer.x,
      y: scenePointer.y,
    };

    updateMultiTouchGesture(this, event);

    if (gesture.pointers.size >= 2) {
      return;
    }

    // a viewport gesture owns the pointer: no hover affordance may run,
    // least of all one that would take the pan cursor back
    if (
      isHoldingSpace() ||
      isGestureActive() ||
      isDraggingScrollBar() ||
      isHandToolActive(this.state)
    ) {
      return;
    }

    // NOT the hover pass's gate (that one is upstream's `isPressingAnyButton`,
    // at the top of `maybeUpdateHoverCursor`) but a dispatch: the canvas
    // binding runs instead of the gesture's window listener while the pointer
    // is over the canvas (`markCanvasHandledPointerEvent`), so the gesture's
    // own move handling has to happen from here.
    if (this.pointerDownState) {
      this.onPointerMoveFromPointerDown(event);
      return;
    }

    const isOverScrollBar = getScrollBarsAtPointer(this, event).isOverEither;
    if (
      !this.state.newElement &&
      !this.state.selectionElement &&
      !this.state.selectedElementsAreBeingDragged &&
      !this.state.multiElement
    ) {
      if (isOverScrollBar) {
        this.cursor.set(CURSOR_TYPE.AUTO);
      } else {
        this.cursor.applyForTool();
      }
    }

    if (handleMultiElementPointerMove(this, event)) {
      return;
    }

    maybeSuggestBindingOnHover(this, event);
    maybeUpdateFrameToHighlightOnPointerMove(
      this,
      scenePointer,
      isOverScrollBar,
    );
    this.arrowText.updateHoveredAnchor(scenePointer);
    this.maybeUpdateHoverCursor(scenePointer, event, isOverScrollBar);
  }

  /**
   * Restricted pointer handling for the non-interactive editor with links
   * and/or embeds allowed (`interaction.enabled.links` / `.embeds` /
   * `.interactiveContent`) — runs only the element-link & embed concerns
   * (shared with the full pointer handlers above) so they behave like in
   * view mode without the rest of the canvas pointer machinery.
   */
  private handleInteractiveContentPointerMove(event: PointerEvent) {
    const scenePointer = viewportCoordsToSceneCoords(event, this.state);
    const hitElementMightBeLocked = getElementAtPosition(
      this,
      scenePointer.x,
      scenePointer.y,
      { includeLockedElements: true },
    );

    if (this.isEmbedsEnabled()) {
      const hitElement = hitElementMightBeLocked?.locked
        ? null
        : hitElementMightBeLocked;
      if (
        handleIframeLikeElementHover(this, {
          hitElement,
          scenePointer,
          moveEvent: event,
        })
      ) {
        return;
      }
    }

    this.hitLinkElement = this.isLinksEnabled()
      ? getElementLinkAtPosition(this, scenePointer, hitElementMightBeLocked)
      : undefined;
    if (!applyElementLinkHoverAffordance(this)) {
      this.cursor.reset();
    }
  }

  /**
   * upstream `App.cacheEmbeddableRef` — called from the per-element
   * `caliburn-embeddable` once its `<iframe>` is in the DOM, standing in for
   * upstream's React `ref` callback. Like upstream's, it never removes an
   * entry: the map is pruned only by the GC pass in `updateEmbeddables`.
   */
  cacheEmbeddableRef(
    element: ExcalidrawIframeLikeElement,
    ref: HTMLIFrameElement | null,
  ) {
    if (ref) {
      this.iFrameRefs.set(element.id, ref);
    }
  }

  /** upstream `App.getHTMLIFrameElement` */
  getHTMLIFrameElement(
    element: ExcalidrawIframeLikeElement,
  ): HTMLIFrameElement | undefined {
    return this.iFrameRefs.get(element.id);
  }

  /** upstream `App.onIframeSrcCopy` */
  onIframeSrcCopy(element: ExcalidrawIframeElement) {
    if (element.customData?.generationData?.status === "done") {
      copyTextToSystemClipboard(element.customData.generationData.html);
      this.setToast({
        message: "copied to clipboard",
        closable: false,
        duration: 1500,
      });
    }
  }

  /** upstream `App.handleIframeLikeCenterClick` */
  private handleIframeLikeCenterClick(): boolean {
    return handleIframeLikeCenterClick(this);
  }

  private handleInteractiveContentPointerUp(event: PointerEvent) {
    this.lastPointerUpEvent = event;

    if (this.isEmbedsEnabled() && this.handleIframeLikeCenterClick()) {
      return;
    }

    const scenePointer = viewportCoordsToSceneCoords(event, this.state);
    if (
      this.isLinksEnabled() &&
      maybeHandleElementLinkClick(this, event, scenePointer)
    ) {
      return;
    }

    // clicking outside an active embed deactivates it (view-mode style;
    // clicks inside it are consumed by the embed itself)
    if (this.state.activeEmbeddable?.state === "active") {
      this.setState({ activeEmbeddable: null });
    }
  }

  /** upstream `App.isHittingTextAutoResizeHandle` */
  private isHittingTextAutoResizeHandle = (
    selectedElements: NonDeleted<ExcalidrawElement>[],
    point: Readonly<{ x: number; y: number }>,
  ): boolean => {
    const activeTextElement = getActiveTextElement(
      selectedElements,
      this.state,
    );

    if (
      activeTextElement &&
      !activeTextElement.isDeleted &&
      !activeTextElement.autoResize &&
      isPointHittingTextAutoResizeHandle(
        point,
        activeTextElement,
        this.state.zoom.value,
        this.editorInterface.formFactor,
      )
    ) {
      return true;
    }

    return false;
  };

  /** upstream `App.handleTextAutoResizeHandlePointerDown` */
  private handleTextAutoResizeHandlePointerDown = (
    selectedElements: NonDeleted<ExcalidrawElement>[],
    point: Readonly<{ x: number; y: number }>,
  ) => {
    const activeTextElement = getActiveTextElement(
      selectedElements,
      this.state,
    );
    if (
      !activeTextElement ||
      !this.isHittingTextAutoResizeHandle(selectedElements, point)
    ) {
      return false;
    }

    this.actionManager.executeAction(
      actionTextAutoResize,
      "ui",
      // we need to pass down the element since it may already be deselected
      // due to the pointerdown
      activeTextElement,
    );
    this.cursor.reset();
    return true;
  };

  /**
   * Upstream's `clearSelectionIfNotUsingSelection`, queued here and applied
   * where React's own queue would let it land. Upstream writes it as a plain
   * `setState` in the middle of the pointer-down handler, which puts it under
   * three of React's rules, all reproduced by `setState` and by
   * `applyPendingSelectionClear` running once the tool dispatch has returned:
   *
   * - a FUNCTIONAL updater queued after it reads the state the clear has
   *   already produced, so the clear is applied before the updater runs.
   *   Both pointer-down writes that matter take this route:
   *   `handleFreeDrawElementOnPointerDown` subtracts its own id from a
   *   selection upstream has by then emptied, and an action result
   *   (`syncActionResult`) spreads over it the appState the action computed
   *   from the pre-clear selection — which is how `actionFinalize` keeps a
   *   multi-point element selected across the clear;
   * - an OBJECT-form write queued after it wins outright, having been
   *   computed from the pre-clear selection `this.state` still shows the
   *   handler. No pointer-down dispatch writes a selection that way today,
   *   so this arm holds the rule rather than carrying a case;
   * - nothing else in the handler observes the clear, and with no later
   *   write it lands as-is.
   *
   * That last arm is all-or-nothing on `selectedElementIds`, where React
   * resolves it per key: an object write of that one key alone would leave
   * `selectedGroupIds`, `editingGroupId` and `activeEmbeddable` uncleared,
   * where upstream still clears them. No caller writes that shape either.
   */
  private armClearSelectionIfNotUsingSelection = (): void => {
    this.pendingSelectionClear = !isSelectionLikeTool(
      this.state.activeTool.type,
    );
  };

  private applyPendingSelectionClear = (): void => {
    if (this.pendingSelectionClear) {
      this.pendingSelectionClear = false;
      deselectElements(this);
    }
  };

  private maybeUpdateHoverCursor(
    scenePointer: { x: number; y: number },
    event: PointerEvent,
    isOverScrollBar: boolean,
  ) {
    // upstream's pointer-move gate (App.tsx:7908), which ends its handler and
    // so covers this whole helper: a pointer that is pressing anything owns
    // the interaction, and the hover affordances stay out of it. Caliburn's
    // own `pointerDownState` arm upstream of this call is the gesture's move
    // DISPATCH rather than a gate, so the pressed-button cases it doesn't
    // cover — a secondary-button drag, a press the pen-mode guard refused, a
    // drag that began off the canvas, a scrollbar drag — land here.
    if (Boolean(event.buttons)) {
      return;
    }

    // upstream's pointer-move gate (App.tsx:7908-7920) admits only these tools
    // to the hover affordances, while caliburn gates its own branches further
    // down (the laser short-circuit, `isSelectionLikeTool`) — so this block
    // carries upstream's tool list itself, and everything upstream runs behind
    // that gate (the auto-resize handle, then the transform handles) lives
    // inside it.
    if (
      isSelectionLikeTool(this.state.activeTool.type) ||
      this.state.activeTool.type === "text" ||
      this.state.activeTool.type === "eraser" ||
      this.state.activeTool.type === "laser"
    ) {
      const elements = this.scene.getNonDeletedElements();

      const selectedElements = this.scene.getSelectedElements(this.state);

      if (this.isHittingTextAutoResizeHandle(selectedElements, scenePointer)) {
        this.cursor.set(CURSOR_TYPE.POINTER);
        return;
      }

      if (
        selectedElements.length === 1 &&
        !isOverScrollBar &&
        !this.state.selectedLinearElement?.isEditing
      ) {
        // for linear elements, we'd like to prioritize point dragging over edge resizing
        // therefore, we update and check hovered point index first
        if (this.state.selectedLinearElement) {
          handleHoverSelectedLinearElement(
            this,
            this.state.selectedLinearElement,
            scenePointer.x,
            scenePointer.y,
          );
        }

        if (
          (!this.state.selectedLinearElement ||
            this.state.selectedLinearElement.hoverPointIndex === -1) &&
          this.state.openDialog?.name !== "elementLinkSelector" &&
          !(
            selectedElements.length === 1 && isElbowArrow(selectedElements[0])
          ) &&
          // HACK: Disable transform handles for linear elements on mobile until a
          // better way of showing them is found
          !(
            isLinearElement(selectedElements[0]) &&
            (this.editorInterface.userAgent.isMobileDevice ||
              selectedElements[0].points.length === 2)
          )
        ) {
          const elementWithTransformHandleType =
            getElementWithTransformHandleType(
              elements,
              this.state,
              scenePointer.x,
              scenePointer.y,
              this.state.zoom,
              event.pointerType as PointerType,
              this.scene.getNonDeletedElementsMap(),
              this.editorInterface,
            );
          if (
            elementWithTransformHandleType &&
            elementWithTransformHandleType.transformHandleType
          ) {
            this.cursor.set(
              getCursorForResizingElement(elementWithTransformHandleType),
            );
            return;
          }
        }
      } else if (
        selectedElements.length > 1 &&
        !isOverScrollBar &&
        this.state.openDialog?.name !== "elementLinkSelector"
      ) {
        const transformHandleType = getTransformHandleTypeFromCoords(
          getCommonBounds(selectedElements),
          scenePointer.x,
          scenePointer.y,
          this.state.zoom,
          event.pointerType as PointerType,
          this.editorInterface,
        );
        if (transformHandleType) {
          this.cursor.set(
            getCursorForResizingElement({
              transformHandleType,
            }),
          );
          return;
        }
      }
    }

    // upstream's hover path leaves the eraser alone: it reaches here (its
    // tool gate lets the eraser through so the transform-handle cursors
    // still run) and returns before every hit-element affordance below
    if (isEraserActive(this.state)) {
      return;
    }

    const hitElementMightBeLocked = getElementAtPosition(
      this,
      scenePointer.x,
      scenePointer.y,
      { preferSelected: true, includeLockedElements: true },
    );

    let hitElement: NonDeleted<ExcalidrawElement> | null = null;
    if (hitElementMightBeLocked && hitElementMightBeLocked.locked) {
      hitElement = null;
    } else {
      hitElement = hitElementMightBeLocked;
    }

    // upstream's `if (!this.handleIframeLikeElementHover(...))` — an
    // iframe-like element taking the hover owns the pointer, element links
    // included. Unguarded, as upstream is: only the fully interactive editor
    // reaches here, and there embeds are always enabled.
    if (
      !handleIframeLikeElementHover(this, {
        hitElement,
        scenePointer,
        moveEvent: event,
      })
    ) {
      this.hitLinkElement = this.isLinksEnabled()
        ? getElementLinkAtPosition(this, scenePointer, hitElementMightBeLocked)
        : undefined;
    }

    if (applyElementLinkHoverAffordance(this)) {
      return;
    }

    // upstream's `if (isLaserTool) { return; }` — the laser tool keeps the
    // cursor it painted, skipping the hyperlink popup and the branches below
    if (this.state.activeTool.type === "laser") {
      return;
    }

    // upstream's `else if` chain (App.tsx:8043-8104): each branch is terminal
    // for the cursor, but every one of them falls through to the selected
    // linear element's hover pass below (App.tsx:8106) — which is what draws
    // the point & midpoint handles while the line editor is open, the one
    // case the transform-handle block above skips
    if (
      hitElement &&
      (hitElement.link || isEmbeddableElement(hitElement)) &&
      this.state.selectedElementIds[hitElement.id] &&
      !this.state.contextMenu &&
      !this.state.showHyperlinkPopup
    ) {
      this.setState({ showHyperlinkPopup: "info" });
    } else if (
      // upstream's own arm (App.tsx:8060-8066) rather than a case of the
      // merged one below: it precedes the view-mode, element-link and
      // scrollbar arms, so a pointer inside the selection's bounding box
      // drags it whatever is underneath. The tool gate is caliburn's — it
      // stands in for upstream's pointer-move gate (:7908-7920), which this
      // helper has no counterpart for
      isSelectionLikeTool(this.state.activeTool.type) &&
      !event[KEYS.CTRL_OR_CMD] &&
      isHittingCommonBoundingBoxOfSelectedElements(
        this,
        scenePointer,
        this.scene.getSelectedElements(this.state),
      )
    ) {
      this.cursor.set(CURSOR_TYPE.MOVE);
    } else if (this.state.viewModeEnabled) {
      this.cursor.set(CURSOR_TYPE.GRAB);
    } else if (isOverScrollBar) {
      this.cursor.set(CURSOR_TYPE.AUTO);
    } else if (isSelectionLikeTool(this.state.activeTool.type)) {
      if (
        // if using cmd/ctrl, we're not dragging
        !event[KEYS.CTRL_OR_CMD] &&
        // editing text -> don't show move cursor when hovering over its bbox
        hitElement?.id !== this.state.editingTextElement?.id &&
        (hitElement ||
          isHittingCommonBoundingBoxOfSelectedElements(
            this,
            scenePointer,
            this.scene.getSelectedElements(this.state),
          )) &&
        !hitElement?.locked
      ) {
        this.cursor.set(CURSOR_TYPE.MOVE);
      } else {
        this.cursor.reset();
      }
    }

    // upstream reaches this second call (App.tsx:8106) only with the
    // selection, lasso or text tool — its pointer-move gate (:7908-7920)
    // minus the eraser (:8004) and laser (:8041) returns above. The tool
    // list has to be spelled out because caliburn has no such gate: a
    // drawing tool laying down a multi-point line keeps a
    // `selectedLinearElement` between clicks, whose uncommitted last point
    // follows the pointer, so every move would hover a point of its own —
    // taking the crosshair away and drawing a hovered-point handle.
    if (
      (isSelectionLikeTool(this.state.activeTool.type) ||
        this.state.activeTool.type === "text") &&
      this.state.selectedLinearElement
    ) {
      handleHoverSelectedLinearElement(
        this,
        this.state.selectedLinearElement,
        scenePointer.x,
        scenePointer.y,
      );
    }
  }

  handleCanvasPointerUp(event: PointerEvent) {
    markCanvasHandledPointerEvent(event);
    // the gesture ends here, so its window listeners have nothing left to do
    endPointerSession();
    // upstream returns early whenever non-interactive: a tool allowed via
    // `interaction.enabled.tools` finishes its stroke through the window
    // listeners its own pointerdown installed, which is why the teardown
    // itself carries no such gate.
    if (
      !this.isInteractionEnabled() &&
      !this.isToolSupported(this.state.activeTool.type)
    ) {
      if (this.isLinksEnabled() || this.isEmbedsEnabled()) {
        this.batchCommits(() => this.handleInteractiveContentPointerUp(event));
      }
      return;
    }
    this.batchCommits(() => {
      if (getFeatureFlag("COMPLEX_BINDINGS")) {
        this.delayedBindMode.resetDelayedBindMode();
      }

      this.handleCanvasPointerUpImpl(event);
      this.applyPendingIsBindingEnabledRestore();
    });
  }

  /** upstream binds `removePointer` on the interactive canvas's pointercancel */
  removePointer(event: PointerEvent) {
    this.batchCommits(() => removePointer(this, event));
  }

  /** the same, from upstream's document-level pointerup listener — the
   * canvas's own release already went through `handleCanvasPointerUpImpl` and
   * the map is a `delete` by pointer id either way */
  private removeDocumentPointer = (event: PointerEvent) => {
    this.removePointer(event);
  };

  private handleCanvasPointerUpImpl(event: PointerEvent) {
    // read once at the top, as upstream's own pointer-up handler does, so the
    // branches below all measure against the scene the gesture ended on
    const elementsMap = this.scene.getNonDeletedElementsMap();

    // a missing-pointer-up cleanup replays this with the gesture's pointer
    // DOWN event, which must not be mistaken for a release
    const isGenuinePointerUp = event.type === "pointerup";

    removePointer(this, event);

    // upstream resets `cursorButton` and broadcasts the released pointer
    // from the gesture's own pointer-up handler; caliburn's per-interaction
    // teardowns only cover some of the branches below, so both live here —
    // still gated on a gesture being in flight, so that a release which
    // never opened one (a second finger's, a non-primary button's) leaves
    // the state alone, as upstream does. A pointer-capturing tool (the
    // laser) strokes without a `pointerDownState` of its own, so it needs
    // naming here.
    if (this.pointerDownState || this.isActiveToolPointerCapturing()) {
      if (this.state.cursorButton !== "up") {
        this.setState({ cursorButton: "up" });
      }
      this.savePointer(event.clientX, event.clientY, "up");
    }

    // an armed bucket fill commits only on a GENUINE pointer up: a tool
    // switch mid-press orphans the click, which must discard the fill
    // instead of committing an unwanted edit.
    if (isGenuinePointerUp && this.state.activeTool.type === "bucketfill") {
      this.bucketFill.handlePointerUp();
    } else {
      this.bucketFill.cancel();
    }

    if (isGenuinePointerUp) {
      // upstream's `isDoubleClick` (`App.tsx`), read by the pointer-up text
      // edit so the second release of a double click leaves the caret to the
      // double-click handler instead of placing it at the click point
      this.lastPointerUpIsDoubleClick =
        this.lastPointerUpEvent != null &&
        event.timeStamp - this.lastPointerUpEvent.timeStamp <=
          TAP_TWICE_TIMEOUT;
      this.lastPointerUpEvent = event;
    }

    this.armRestoreIsBindingEnabledToPreference(event);

    this.lastPointerMoveCoords = viewportCoordsToSceneCoords(event, this.state);

    // upstream runs this from `handleCanvasPointerUp`, whose `return` only
    // ends that handler — the gesture's own `onPointerUp`, which the rest of
    // this method stands in for, still runs — so it consumes the element-link
    // click below and nothing else
    const iframeLikeCenterClickHandled =
      isGenuinePointerUp &&
      this.isEmbedsEnabled() &&
      this.handleIframeLikeCenterClick();

    const elementLinkClickHandled =
      !iframeLikeCenterClickHandled &&
      isGenuinePointerUp &&
      this.isLinksEnabled() &&
      maybeHandleElementLinkClick(
        this,
        event,
        viewportCoordsToSceneCoords(event, this.state),
      );

    if (elementLinkClickHandled) {
      this.finishPointerUp();
      return;
    }

    // upstream's view-mode tail of `handleCanvasPointerUp`: a release that
    // neither activated an embed nor followed an element link deactivates
    // whatever embed was active and clears the selection
    if (
      !iframeLikeCenterClickHandled &&
      isGenuinePointerUp &&
      this.state.viewModeEnabled
    ) {
      this.setState({
        activeEmbeddable: null,
        selectedElementIds: {},
      });
    }

    if (this.pointerDownState) {
      // upstream resets this alongside the rest of the drag teardown, near
      // the top of its own pointer-up handler — so every branch below gets
      // it, not just the ones reaching `cleanupAfterDragOnPointerUp`, and
      // the next gesture's first move measures from its own origin
      this.previousPointerMoveCoords = null;
      this.onPointerUp()?.(this.state.activeTool, this.pointerDownState, event);
      this.onPointerUpEmitter.trigger(
        this.state.activeTool,
        this.pointerDownState,
        event,
      );
      if (this.state.activeTool.type === "custom") {
        this.finishPointerUp();
        return;
      }
      if (this.state.activeTool.type === "laser") {
        this.laserTrails.endPath();
        this.finishPointerUp();
        return;
      }
      if (this.state.activeTool.type === "autoshape") {
        // upstream's `activeTool.type === "autoshape"` pointer-up branch
        // (`App.tsx`): the sketch resolves through the finalize funnel and
        // the handler returns, so none of the new-element paths below —
        // which would select the recognized shape and revert the tool —
        // ever see the recognition preview sitting in `newElement`
        this.actionManager.executeAction(actionFinalize);
        this.finishPointerUp();
        return;
      }
      if (this.state.newElement?.type === "freedraw") {
        finalizeFreeDrawOnPointerUp(this, event);
      } else if (isLinearElement(this.state.newElement)) {
        finalizeLinearOnPointerUp(this, this.pointerDownState, event);
      } else if (isTextElement(this.state.newElement)) {
        handleTextElementOnPointerUp(this, this.state.newElement);
      } else if (this.state.newElement) {
        finalizeNewElementOnPointerUp(this, this.pointerDownState);
      } else {
        handleLinearEditorPointerUp(this, this.pointerDownState, event);
        updateActiveLockedIdOnPointerUp(this, this.pointerDownState, event);
        renormalizeBoundElbowArrowsOnPointerUp(
          this,
          this.pointerDownState,
          elementsMap,
        );
        handleSelectionPointerUp(this, this.pointerDownState, event);
        updateFrameMembershipOnPointerUp(this, this.pointerDownState, event);
        maybeSelectLinearElementOnPointerUp(this, this.pointerDownState);
        // upstream's "click outside the cropping region to exit" — ahead of
        // the deselect below, which returns from upstream's handler, and
        // must read isCropping before the cleanup at the end resets it
        maybeFinishImageCroppingOnPointerUp(this, this.pointerDownState);
        // upstream runs this — the erase and its `else if
        // (elementsPendingErasure.size)` restore — before the new-element
        // finalize paths; caliburn's are the sibling branches above, so the
        // restore is out of their reach. Unreachable in practice: an eraser
        // gesture never produces a `newElement`, and the reachable restore
        // (a tool switch mid-gesture) still lands here.
        if (maybeEraseOnPointerUp(this)) {
          this.finishPointerUp();
          return;
        }
        // a click that deselected ends upstream's pointer-up handler right
        // there — only the teardown it had already run stays
        const deselected = maybeDeselectOnPointerUp(
          this,
          this.pointerDownState,
        );
        if (!deselected) {
          if (
            maybeStartTextEditingOnPointerUp(this, this.pointerDownState, event)
          ) {
            this.finishPointerUp();
            return;
          }
        }
        cleanupAfterDragOnPointerUp(this, this.pointerDownState);
        // upstream's tail — the tool revert every branch above carries its
        // own copy of. Only a deselect skips it: that ends upstream's handler
        // before the tail. A missing-pointer-up replay reaches it as any
        // other release does, since upstream's cleanup emitter re-runs the
        // whole pointer-up handler with the gesture's pointer DOWN event
        // (`App.tsx`'s `missingPointerEventCleanupEmitter.once`).
        if (!deselected) {
          revertActiveToolOnPointerUp(this);
        }
      }
      this.finishPointerUp();
    }
  }

  /**
   * The teardown every exit from the gesture's pointer up passes through.
   * Upstream writes the bind mode from the top of its own handler, where
   * React's batching keeps the new value out of the reach of everything that
   * follows — the finalize funnel reads the mode the gesture ran under
   * (`binding.ts`). Caliburn's writes commit as they are made, so the write
   * lands here instead, past every branch's reads and on every path out.
   */
  private finishPointerUp() {
    if (getFeatureFlag("COMPLEX_BINDINGS")) {
      this.delayedBindMode.resetDelayedBindMode();
    }

    this.setState({
      bindMode: "orbit",
    });
    this.clearHighlightsOnPointerUp();
    this.pointerDownState = null;
  }

  /**
   * The in-flight gesture's window-level pointer up. Unlike the canvas
   * binding this carries no interaction gate: the session is only installed
   * while the gesture is allowed to run, and upstream's teardown likewise
   * runs unconditionally once installed.
   */
  handlePointerUpFromPointerDown(event: PointerEvent) {
    this.batchCommits(() => {
      this.handleCanvasPointerUpImpl(event);
      this.applyPendingIsBindingEnabledRestore();
    });
  }

  /**
   * pointerup may not fire in certian cases (user tabs away...), so in order
   * to properly cleanup pointerdown state, we need to fire any hanging
   * pointerup handlers manually
   */
  private maybeCleanupAfterMissingPointerUp = (event: PointerEvent | null) => {
    endPanSession();
    endScrollBarSession();
    replayPointerSessionUp(event);
    this.missingPointerEventCleanupEmitter.trigger(event).clear();
  };

  /**
   * The single selected element the hyperlink popup renders for, as a
   * one-or-zero item list so `@for`'s `track` gives it upstream's per-element
   * `key` (a different element remounts the popup, submitting the previous
   * one's edit).
   */
  hyperlinkElements(): readonly NonDeletedExcalidrawElement[] {
    this.changeGeneration();
    if (
      !this.state.showHyperlinkPopup ||
      this.state.openDialog?.name === "elementLinkSelector"
    ) {
      return [];
    }
    const selectedElements = this.scene.getSelectedElements(this.state);
    return selectedElements.length === 1 ? selectedElements : [];
  }

  protected readonly copySourceLabel = translated(() => t("labels.copySource"));

  /**
   * The single selected `iframe` element upstream renders its
   * `ElementCanvasButtons` column for — the copy-source and fullscreen pair.
   * `null` covers both upstream's own condition and `ElementCanvasButtons`'
   * early return, which Angular cannot express from inside a host element.
   *
   * Upstream renders a second such column for a selected magic frame (the AI
   * "convert to code" trigger, gated behind `aiEnabled`); that one is not
   * part of the port.
   */
  iframeCanvasButtonsElement(): NonDeleted<ExcalidrawIframeElement> | null {
    this.changeGeneration();
    if (!this.isDefaultUIEnabled() || areElementCanvasButtonsHidden(this)) {
      return null;
    }
    const selectedElements = this.scene.getSelectedElements(this.state);
    const firstSelectedElement = selectedElements[0];
    return selectedElements.length === 1 &&
      isIframeElement(firstSelectedElement) &&
      firstSelectedElement.customData?.generationData?.status === "done"
      ? firstSelectedElement
      : null;
  }

  /** upstream's "Enter fullscreen" `ElementCanvasButton` for an iframe element */
  requestEmbeddableFullscreen(element: NonDeleted<ExcalidrawIframeElement>) {
    const iframe = this.getHTMLIFrameElement(element);
    if (iframe) {
      try {
        iframe.requestFullscreen();
        this.setState({
          activeEmbeddable: {
            element,
            state: "active",
          },
          selectedElementIds: {
            [element.id]: true,
          },
          newElement: null,
          selectionElement: null,
        });
      } catch (err: any) {
        console.warn(err);
        this.setState({
          errorMessage: "Couldn't enter fullscreen",
        });
      }
    }
  }

  private clearHighlightsOnPointerUp() {
    if (this.state.frameToHighlight || this.state.elementsToHighlight) {
      this.setState({ frameToHighlight: null, elementsToHighlight: null });
    }
  }

  /** upstream `App.tsx`'s `resetScene` */
  resetScene = (opts?: { resetLoadingState: boolean }) => {
    this.scene.replaceAllElements([]);
    this.setState((state) => ({
      ...getDefaultAppState(),
      isLoading: opts?.resetLoadingState ? false : state.isLoading,
      theme: this.state.theme,
    }));
    this.store.clear();
    this.history.clear();
  };

  private api: CaliburnImperativeAPI | null = null;

  private _initialized = false;
  private _mounted = false;

  /**
   * Upstream emits `editor:mount` from `componentDidMount` and
   * `editor:initialize` from `componentDidUpdate`, so mount always comes
   * first. Caliburn's `commit()` stands in for both, and the scene is
   * initialized before the view-init hook returns — hence the explicit
   * ordering gate.
   */
  private maybeEmitInitialize() {
    if (this._mounted && !this._initialized && !this.state.isLoading) {
      this._initialized = true;
      this.editorLifecycleEvents.emit("editor:initialize", this.getApi());
      this.onInitialize()?.(this.getApi());
    }
  }

  getApi(): CaliburnImperativeAPI {
    return (this.api ??= this.createApi());
  }

  private createApi(): CaliburnImperativeAPI {
    return {
      isDestroyed: false,
      id: this.id,
      updateScene: this.updateScene,
      applyDeltas: this.applyDeltas,
      resetScene: this.resetScene,
      mutateElement: this.mutateElement,
      updateLibrary: this.library.updateLibrary,
      toggleSidebar: this.toggleSidebar,
      addFiles: (files: BinaryFileData[]) => {
        const { addedFiles } = this.addMissingFiles(files);

        this.clearImageShapeCache(addedFiles);
        this.scene.triggerUpdate();

        addNewImagesToImageCache(this);
      },
      getSceneElementsIncludingDeleted: () =>
        this.getSceneElementsIncludingDeleted(),
      getSceneElementsMapIncludingDeleted: () =>
        this.getSceneElementsMapIncludingDeleted(),
      history: {
        clear: () => this.history.clear(),
      },
      setViewport: this.viewport.setViewport,
      getViewportOffsets: this.viewport.getOffsets,
      getSceneElements: () => this.getSceneElements(),
      getAppState: () => this.state,
      getFiles: () => this.files,
      registerAction: (action) => {
        this.actionManager.registerAction(action);
      },
      setActiveTool: this.setActiveTool,
      setCursor: this.cursor.set,
      resetCursor: this.cursor.reset,
      getEditorInterface: () => this.editorInterface,
      onChange: (cb) => this.onChangeEmitter.on(cb),
      onIncrement: (cb) => this.store.onStoreIncrementEmitter.on(cb),
      onScrollChange: (cb) => this.onScrollChangeEmitter.on(cb),
      onUserFollow: (cb) => this.onUserFollowEmitter.on(cb),
      onPointerDown: (cb) => this.onPointerDownEmitter.on(cb),
      onPointerUp: (cb) => this.onPointerUpEmitter.on(cb),
      onStateChange: this.onStateChange,
      onEvent: this.onEvent,
    };
  }

  focusContainer = () => {
    this.containerRef()?.nativeElement?.focus();
  };

  /** upstream `App.toggleSidebar` */
  toggleSidebar = ({
    name,
    tab,
    force,
  }: {
    name: SidebarName | null;
    tab?: SidebarTabName;
    force?: boolean;
  }): boolean => {
    let nextName;
    if (force === undefined) {
      nextName =
        this.state.openSidebar?.name === name &&
        this.state.openSidebar?.tab === tab
          ? null
          : name;
    } else {
      nextName = force ? name : null;
    }

    const nextState: AppState["openSidebar"] = nextName
      ? { name: nextName }
      : null;
    if (nextState && tab) {
      nextState.tab = tab;
    }

    this.batchCommits(() => this.setState({ openSidebar: nextState }));

    return !!nextName;
  };

  /** upstream `App.onInsertElements` */
  onInsertElements = (elements: readonly ExcalidrawElement[]) => {
    addElementsFromPasteOrLibrary(this, {
      elements,
      position: "center",
      files: null,
    });
  };

  get excalidrawContainerValue(): { container: HTMLDivElement | null } {
    return { container: this.containerRef()?.nativeElement ?? null };
  }

  getName = () => {
    return (
      this.state.name ||
      this.props.name ||
      `${t("labels.untitled")}-${getDateTime()}`
    );
  };

  onExportImage = async (
    type: keyof typeof EXPORT_IMAGE_TYPES,
    elements: ExportedElements,
    opts: { exportingFrame: NonDeleted<ExcalidrawFrameLikeElement> | null },
  ) => {
    trackEvent("export", type, "ui");
    const fileHandle = await exportCanvas(
      type,
      elements,
      this.state,
      this.files,
      {
        exportBackground: this.state.exportBackground,
        name: this.getName(),
        viewBackgroundColor: this.state.viewBackgroundColor,
        exportingFrame: opts.exportingFrame,
      },
    )
      .catch(muteFSAbortError)
      .catch((error) => {
        console.error(error);
        this.setState({ errorMessage: error.message });
      });

    if (
      this.state.exportEmbedScene &&
      fileHandle &&
      isImageFileHandle(fileHandle)
    ) {
      this.setState({ fileHandle });
    }
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
    return this.state.activeTool.locked || this.activeTool() !== null;
  }

  /**
   * Re-asserts the host-controlled invariants after every state write:
   * a non-interactive editor is always in view mode, `state.activeTool`
   * tracks `props.activeTool`, and — while non-interactive — the active
   * tool is either input-enabled (`interaction.enabled.tools`) or the
   * neutral default. `setActiveTool` refuses non-matching activations
   * while forced; this backstop covers the writers that bypass the funnel
   * (actions, `updateScene`, the host's own `viewModeEnabled` prop).
   */
  private applyStateInvariants() {
    // non-interactive editor implies view mode (overrides both action
    // results and the host-supplied `viewModeEnabled` prop)
    if (!this.isInteractionEnabled() && !this.state.viewModeEnabled) {
      this.state = { ...this.state, viewModeEnabled: true };
    }

    // a host-controlled zen mode overrides action results (upstream forces
    // it in `syncActionResult` and re-syncs it in `componentDidUpdate`)
    const zenModeEnabled = this.zenModeEnabled();
    if (
      zenModeEnabled !== undefined &&
      this.state.zenModeEnabled !== zenModeEnabled
    ) {
      this.state = { ...this.state, zenModeEnabled };
    }

    const forcedTool = this.activeTool?.();
    if (
      forcedTool &&
      (forcedTool.type as string) !== "image" &&
      this.isToolSupported(forcedTool.type) &&
      !this.isSameForcedTool(forcedTool, this.state.activeTool)
    ) {
      this.state = {
        ...this.state,
        activeTool: updateActiveTool(this.state, forcedTool),
      };
    }

    // reset stale tool state (e.g. a presenter's laser after handing off)
    // so it doesn't leak through `onChange` or linger until interaction is
    // re-enabled
    if (
      !this.isInteractionEnabled() &&
      !this.isToolSupported(this.state.activeTool.type) &&
      this.state.activeTool.type !== "selection"
    ) {
      this.state = {
        ...this.state,
        activeTool: updateActiveTool(this.state, { type: "selection" }),
      };
    }
  }

  /**
   * Upstream's `index.tsx` normalization, which runs on every render. Rebuilt
   * from `DEFAULT_UI_OPTIONS` and the raw input rather than layered onto the
   * previous result — the host dropping a key has to drop it here too — but
   * assigned into the existing `props.UIOptions` so the object the chrome
   * captured stays the one it reads.
   */
  private normalizeUIOptions() {
    const target = this.props.UIOptions as unknown as Record<string, unknown>;
    for (const key of Object.keys(target)) {
      delete target[key];
    }

    const uiOptions = this.UIOptions();
    const canvasActions = uiOptions?.canvasActions;
    Object.assign(this.props.UIOptions, uiOptions, {
      canvasActions: {
        ...DEFAULT_UI_OPTIONS.canvasActions,
        ...canvasActions,
      },
      tools: {
        image: uiOptions?.tools?.image ?? true,
      },
    });
    if (canvasActions?.export) {
      this.props.UIOptions.canvasActions.export.saveFileToDisk =
        canvasActions.export?.saveFileToDisk ??
        DEFAULT_UI_OPTIONS.canvasActions.export.saveFileToDisk;
    }

    // upstream normalizes `UIOptions.canvasActions.toggleTheme` from its
    // `null` default to `true` whenever the host controls no theme, or
    // controls it but listens for changes (`index.tsx`)
    if (
      this.props.UIOptions.canvasActions.toggleTheme === null &&
      (this.theme() == null || this.props.onThemeChange)
    ) {
      this.props.UIOptions.canvasActions.toggleTheme = true;
    }
  }

  /**
   * Re-resolves the host props upstream resolves per render: `index.tsx`
   * re-normalizes `UIOptions`, and `App.tsx` reads `props.gridModeEnabled`
   * (`isGridModeEnabled`, `actionToggleGridMode`'s predicate), `props.name`
   * (`getName`) and `props.libraryReturnUrl` (`LibraryMenu`) live off the
   * props it was handed. Only the props are refreshed — upstream's
   * `componentDidUpdate` syncs `zenModeEnabled` and `theme` back into the
   * state, and nothing else.
   */
  private syncHostProps() {
    this.normalizeUIOptions();
    this.props.gridModeEnabled = this.gridModeEnabled();
    this.props.name = this.name();
    this.props.libraryReturnUrl = this.libraryReturnUrl();
  }

  private prevInteraction: boolean | InteractionConfig | null | undefined;
  private prevViewModeEnabled: boolean | undefined;
  private prevTheme: Theme | undefined;
  private prevForcedTool:
    | ({ type: ToolType } | { type: "custom"; customType: string })
    | null = null;

  private handlePropsChange(prevProps: {
    interaction: boolean | InteractionConfig | null | undefined;
    viewModeEnabled: boolean | undefined;
    activeTool:
      | ({ type: ToolType } | { type: "custom"; customType: string })
      | null;
    theme: Theme | undefined;
  }) {
    const wasToolSupported = this.isToolSupported(
      this.state.activeTool.type,
      prevProps,
    );

    this.handleInteractionStateChange(prevProps);
    this.handleForcedToolChange(prevProps);

    const theme = this.theme();
    if (prevProps.theme !== theme && theme) {
      this.setState({ theme });
    }

    // re-applies the state invariants (`applyStateInvariants`) and re-renders
    // the chrome for whatever the handlers above left unchanged
    this.setState({});

    if (
      wasToolSupported !== this.isToolSupported(this.state.activeTool.type) ||
      this.isNavigationEnabled(prevProps) !== this.isNavigationEnabled()
    ) {
      this.cursor.reset();
    }
  }

  private handleInteractionStateChange(
    prevProps: InteractionProps & { viewModeEnabled: boolean | undefined },
  ) {
    const prevViewModeEnabled = this.state.viewModeEnabled;
    const wasInteractionEnabled = this.isInteractionEnabled(prevProps);
    const interactionEnabledChanged =
      wasInteractionEnabled !== this.isInteractionEnabled();
    const viewModePropChanged =
      prevProps.viewModeEnabled !== this.viewModeEnabled();

    // Preserve internally toggled view mode while interactive and
    // uncontrolled. Synchronize it when its prop changes, when interaction
    // is re-enabled, or when non-interactive mode needs to force it on.
    let nextViewModeEnabled = this.state.viewModeEnabled;
    if (!this.isInteractionEnabled()) {
      nextViewModeEnabled = true;
    } else if (viewModePropChanged || interactionEnabledChanged) {
      nextViewModeEnabled = !!this.viewModeEnabled();
    }
    if (nextViewModeEnabled !== this.state.viewModeEnabled) {
      this.setState({ viewModeEnabled: nextViewModeEnabled });
    }

    const editingWasEnabled = wasInteractionEnabled && !prevViewModeEnabled;
    const editingEnabled =
      this.isInteractionEnabled() && !this.state.viewModeEnabled;
    const becameNonInteractive =
      interactionEnabledChanged && !this.isInteractionEnabled();

    if (becameNonInteractive || (editingWasEnabled && !editingEnabled)) {
      this.terminateActiveInteraction();
    }

    if (this.isEmbedsEnabled(prevProps) !== this.isEmbedsEnabled()) {
      if (!this.isEmbedsEnabled()) {
        this.setState({ activeEmbeddable: null });
      }
    }

    if (
      this.isToolSupported(this.state.activeTool.type, prevProps) !==
      this.isToolSupported(this.state.activeTool.type)
    ) {
      if (!this.isToolSupported(this.state.activeTool.type)) {
        // end a possibly mid-stroke laser trail (the stroke's own window
        // listeners tear down on the next pointerup)
        this.laserTrails.endPath();
      }
    }
  }

  /**
   * Keeps `state.activeTool` synced to `props.activeTool` across prop
   * changes, and re-applies the forced tool once it becomes activatable
   * (e.g. `interaction` config changes).
   */
  private handleForcedToolChange(
    prevProps: InteractionProps & {
      activeTool:
        | ({ type: ToolType } | { type: "custom"; customType: string })
        | null;
    },
  ) {
    const forcedTool = this.activeTool();
    if (!forcedTool) {
      return;
    }

    const forcedToolChanged = !this.isSameForcedTool(
      prevProps.activeTool,
      forcedTool,
    );

    if ((forcedTool.type as string) === "image") {
      if (forcedToolChanged) {
        console.warn(`"image" tool cannot be forced via "props.activeTool"`);
      }
      return;
    }

    if (this.isSameForcedTool(forcedTool, this.state.activeTool)) {
      return;
    }

    // (re)force only on relevant changes so that a standing refusal (tool
    // disabled, or not enabled while non-interactive) warns once instead of
    // on every update
    if (
      forcedToolChanged ||
      this.isToolSupported(forcedTool.type, prevProps) !==
        this.isToolSupported(forcedTool.type)
    ) {
      this.setActiveTool(forcedTool);
    }
  }

  /**
   * Ends whatever interaction is in flight — called when the editor becomes
   * non-interactive (or leaves edit mode) so no gesture, transient or
   * selection outlives it.
   */
  private terminateActiveInteraction() {
    // Complete any active pointer interaction before clearing the state it
    // relies on. Among other things this tears down window-level listeners.
    this.maybeCleanupAfterMissingPointerUp(null);

    resetGesture();
    resetScrollBarDrag();
    // the replay above ends any gesture that had a session; dropping the
    // state covers the rest, so no in-flight drag can resume once
    // interaction returns
    this.pointerDownState = null;
    this.touchInput.terminate();
    resetPlainPasteTracking();

    if (this.bindModeHandler) {
      clearTimeout(this.bindModeHandler);
      this.bindModeHandler = null;
    }

    this.flowchart.clear();

    // These components install their own DOM listeners rather than going
    // through the editor's input handlers, so they must be explicitly
    // unmounted.
    this.bucketFill.closeTemporaryEyeDropper();
    this.activeEyeDropper.set(null);
    this.convertElementTypePopup.set(null);

    if (this.state.editingFrame) {
      const frame = this.scene.getNonDeletedElement(this.state.editingFrame);
      resetEditingFrame(
        this,
        frame && isFrameLikeElement(frame) ? frame : null,
      );
    }

    // textWysiwyg's submit path runs synchronously. Defer until after the
    // current update, then submit whichever text-editing session is active
    // if editing is still disabled.
    queueMicrotask(() => {
      if (!this.isInteractionEnabled() || this.state.viewModeEnabled) {
        this.textWysiwygSubmitHandler?.();
      }
    });

    this.setState({
      contextMenu: null,
      openMenu: null,
      openPopup: null,
      cursorButton: "up",
      bindMode: "orbit",
      activeEmbeddable: null,
      activeLockedId: null,
      selectedElementsAreBeingDragged: false,
      selectionElement: null,
      resizingElement: null,
      isResizing: false,
      isRotating: false,
      isCropping: false,
      croppingElementId: null,
      suggestedBinding: null,
      frameToHighlight: null,
      elementsToHighlight: null,
      snapLines: [],
      showHyperlinkPopup: false,
    });
    this.clearSelection();
    if (!this.isInteractionEnabled()) {
      this.setState({ originSnapOffset: null });
      this.cursor.reset();
    }
  }

  private isSameForcedTool = (
    a: { type: string; customType?: string | null } | null | undefined,
    b: { type: string; customType?: string | null } | null | undefined,
  ) =>
    a?.type === b?.type &&
    (a?.type === "custom" ? a.customType ?? null : null) ===
      (b?.type === "custom" ? b.customType ?? null : null);

  getCurrentItemStrokeWidth(elementType: ExcalidrawElement["type"]) {
    return getStrokeWidthByKey(
      elementType,
      this.state.currentItemStrokeWidthKey,
    );
  }

  /**
   * Upstream's `App.getFormFactor` — the host's `UIOptions.getFormFactor`
   * wins over the measured breakpoints when it is supplied.
   */
  private getFormFactor(editorWidth: number, editorHeight: number) {
    return (
      this.props.UIOptions.getFormFactor?.(editorWidth, editorHeight) ??
      getFormFactor(editorWidth, editorHeight)
    );
  }

  /**
   * Angular port of upstream `App.tsx`'s `refreshEditorInterface`: it measures
   * the editor container and derives every field of the editor interface but
   * `isTouchScreen` from that rect, the stored desktop-UI-mode preference and
   * the user agent, then reconciles the styles-panel mode. As upstream, it
   * returns early while the container is unmounted, leaving the initial
   * (desktop) values.
   *
   * That early return is also the jsdom fallback: the callers that measure are
   * the container `ResizeObserver` (guarded by `supportsResizeObserver`, which
   * is false under jsdom) and the window `resize` handler, neither of which
   * fires there — so a test that needs a sized editor calls this itself,
   * through `withExcalidrawDimensions`, exactly as upstream's tests do.
   * `updateObject` returns the same object when nothing changed, so an
   * unchanged measurement writes no new signal value and schedules no change
   * detection.
   */
  refreshEditorInterface() {
    const container = this.containerRef()?.nativeElement;
    if (!container) {
      return;
    }
    const { width: editorWidth, height: editorHeight } =
      container.getBoundingClientRect();

    const storedDesktopUIMode = loadDesktopUIModePreference();
    const userAgentDescriptor = createUserAgentDescriptor(
      typeof navigator !== "undefined" ? navigator.userAgent : "",
    );
    const editorInterface = this.editorInterfaceSignal();
    // allow host app to control formFactor and desktopUIMode via props
    const sidebarBreakpoint =
      this.props.UIOptions.dockedSidebarBreakpoint != null
        ? this.props.UIOptions.dockedSidebarBreakpoint
        : MQ_RIGHT_SIDEBAR_MIN_WIDTH;

    const nextEditorInterface = updateObject(editorInterface, {
      desktopUIMode: storedDesktopUIMode ?? editorInterface.desktopUIMode,
      formFactor: this.getFormFactor(editorWidth, editorHeight),
      userAgent: userAgentDescriptor,
      canFitSidebar: editorWidth > sidebarBreakpoint,
      isLandscape: editorWidth > editorHeight,
    });

    this.editorInterfaceSignal.set(nextEditorInterface);
    this.reconcileStylesPanelMode(nextEditorInterface);
  }

  /**
   * Upstream's `App.reconcileStylesPanelMode`: the panel's footprint differs
   * between modes, so the viewport's measured styles-panel offset is dropped
   * on every transition, and entering "full" resets the preferred selection
   * tool — the compact and mobile toolbars are the only surfaces that can make
   * lasso the preferred one, and the full toolbar offers no way back.
   */
  private reconcileStylesPanelMode(nextEditorInterface: EditorInterface) {
    const nextStylesPanelMode = deriveStylesPanelMode(nextEditorInterface);
    if (nextStylesPanelMode === this.stylesPanelMode) {
      return;
    }

    const prevStylesPanelMode = this.stylesPanelMode;
    this.stylesPanelMode = nextStylesPanelMode;

    // the panel footprint differs between modes (compact vs full), so a
    // measurement taken in the previous mode no longer applies
    this.viewport.invalidateUIOffset("stylesPanel");

    if (prevStylesPanelMode !== "full" && nextStylesPanelMode === "full") {
      this.setState({
        preferredSelectionTool: {
          type: "selection",
          initialized: true,
        },
      });
    }
  }

  /**
   * upstream `App.refresh` — re-measures where the container sits in the
   * viewport. A host that MOVES the editor without resizing it (a sibling
   * collapsing above it, the page scrolling under a fixed layout) changes
   * nothing the `ResizeObserver` reports, so the offsets the pointer coords
   * are derived from go stale until this is called.
   */
  refresh() {
    this.setState({ ...this.getCanvasOffsets() });
  }

  private getCanvasOffsets(): Pick<AppState, "offsetTop" | "offsetLeft"> {
    const container = this.containerRef()?.nativeElement;
    if (container) {
      const { left, top } = container.getBoundingClientRect();
      return {
        offsetLeft: left,
        offsetTop: top,
      };
    }
    return {
      offsetLeft: 0,
      offsetTop: 0,
    };
  }

  private batchDepth = 0;
  private commitPending = false;
  private sceneInitialized = false;

  /**
   * Defers commits (store capture, onChange, rendering) until the callback
   * finishes — the synchronous equivalent of React's per-event-handler
   * batching, which upstream relies on to coalesce a scheduled capture with
   * an action's own capture into a single history entry.
   */
  batchCommits<T>(fn: () => T): T {
    this.batchDepth++;
    try {
      return fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.commitPending) {
        this.commitPending = false;
        this.commit();
        if (!this.unmounted) {
          this.cdr.detectChanges();
        }
      }
    }
  }

  /**
   * Commits immediately even inside `batchCommits` — the equivalent of
   * React's `flushSync`, for the few upstream sites that force a store
   * commit mid-handler (e.g. capturing a linear element's points before
   * the uncommitted trailing point is added).
   */
  flushCommits() {
    const batchDepth = this.batchDepth;
    this.batchDepth = 0;
    this.commitPending = false;
    try {
      this.commit();
      if (!this.unmounted) {
        this.cdr.detectChanges();
      }
    } finally {
      this.batchDepth = batchDepth;
    }
  }

  /**
   * Validates newly added embeddables. Unlike upstream this needs no
   * `scene.triggerUpdate()` afterwards — the commit renders after it, so the
   * fresh statuses are already picked up by this very render pass.
   */
  private updateEmbeddables() {
    const iframeLikes = new Set<ExcalidrawIframeLikeElement["id"]>();

    for (const element of this.scene.getNonDeletedElements()) {
      if (isEmbeddableElement(element)) {
        iframeLikes.add(element.id);
        if (!this.embedsValidationStatus.has(element.id)) {
          this.embedsValidationStatus.set(
            element.id,
            embeddableURLValidator(element.link, this.validateEmbeddable()),
          );
          ShapeCache.delete(element);
        }
      } else if (isIframeElement(element)) {
        iframeLikes.add(element.id);
      }
    }

    // GC
    this.iFrameRefs.forEach((ref, id) => {
      if (!iframeLikes.has(id)) {
        this.iFrameRefs.delete(id);
      }
    });
  }

  /**
   * Notifies the `onStateChange` listeners of everything committed since the
   * last flush. Upstream flushes from `componentDidUpdate`, so a listener that
   * writes state only schedules another render and its notification arrives
   * from a later, complete pass. Caliburn's `setState` is synchronous, so such
   * a listener re-enters `commit()` mid-flush — and the vendored flush reads
   * the state once before iterating and reassigns its listener list at the
   * end, so a nested pass would leave the listeners after it holding the older
   * value and would drop the `once` bookkeeping the outer pass then redoes.
   * Deferring the nested flush to a second pass of the outer one is upstream's
   * re-render-then-flush-again shape.
   */
  private flushObservers() {
    if (this.flushingObservers) {
      this.observerFlushPending = true;
      return;
    }
    this.flushingObservers = true;
    let depth = 0;
    try {
      do {
        if (++depth > MAX_OBSERVER_FLUSH_DEPTH) {
          throw new Error("Maximum update depth exceeded");
        }
        this.observerFlushPending = false;
        const prevState = this.observedState;
        this.observedState = this.state;
        this.appStateObserver.flush(prevState);
      } while (this.observerFlushPending);
    } finally {
      this.flushingObservers = false;
    }
  }

  private commit() {
    if (this.batchDepth > 0) {
      this.commitPending = true;
      return;
    }
    // must be updated *before* the change listeners are triggered below
    this.maybeEmitInitialize();
    this.changeGeneration.update((generation) => generation + 1);
    this.flushObservers();
    this.updateEmbeddables();
    // assigned rather than `setState`d, which would re-enter this commit; the
    // flag is not observed by the store, so the delta is unaffected either
    // way. Landing after the flush above, it reaches `onStateChange`
    // listeners only on the next commit, where upstream's post-flush
    // `setState` reaches them on the render it schedules immediately —
    // delayed here, not lost
    if (
      this.sceneInitialized &&
      !this.state.showWelcomeScreen &&
      !this.scene.getElementsIncludingDeleted().length
    ) {
      this.state = { ...this.state, showWelcomeScreen: true };
    }
    const shouldExportWithDarkMode =
      (this.sessionExportThemeOverride ?? this.state.theme) === THEME.DARK;
    if (this.state.exportWithDarkMode !== shouldExportWithDarkMode) {
      this.state = {
        ...this.state,
        exportWithDarkMode: shouldExportWithDarkMode,
      };
    }
    this.store.commit(this.scene.getElementsMapIncludingDeleted(), this.state);
    this.onChangeEmitter.trigger(
      this.scene.getElementsIncludingDeleted(),
      this.state,
      this.files,
    );
    if (!this.unmounted) {
      renderEditor(this);
    }
    // Forced false while a viewport animation runs — the scroll-back-to-content
    // button must not render mid-animation (clicking it would fight the
    // animation, which overwrites the viewport every frame). The animation's
    // final commit lands after the animation is unregistered, settling this
    // on the target viewport. Assigned rather than `setState`d for the same
    // reason as the two flags above; upstream's `setState` here likewise only
    // reaches the store on the following commit.
    const scrolledOutside =
      // hide when editing text
      this.state.editingTextElement || this.viewport.isAnimating
        ? false
        : !this.visibleElements.length && this.hasRenderableElements;
    if (this.state.scrolledOutside !== scrolledOutside) {
      this.state = { ...this.state, scrolledOutside };
    }
  }
}
