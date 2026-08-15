import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

import {
  DEFAULT_IMAGE_OPTIONS,
  DEFAULT_UI_OPTIONS,
  THEME,
  arrayToMap,
  getDateTime,
  muteFSAbortError,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  Emitter,
  MIME_TYPES,
  MIN_ZOOM,
  POINTER_BUTTON,
  POINTER_EVENTS,
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
  ShapeCache,
  Store,
  embeddableURLValidator,
  getFrameChildrenInsertionIndex,
  getObservedAppState,
  isElementInGroup,
  isBindingElement,
  isEmbeddableElement,
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
  makeNextSelectedElementIds,
  newElementWith,
  normalizeSVG,
  syncInvalidIndices,
  updateBoundElements,
} from "@excalidraw/element";

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
import { t } from "@excalidraw/excalidraw/i18n";

import { ARROW_TYPE, CURSOR_TYPE, KEYS, isArrowKey } from "@excalidraw/common";

import { findShapeByKey } from "@excalidraw/excalidraw/components/Tools";

import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { Fonts } from "@excalidraw/excalidraw/fonts";
import { LassoTrail } from "@excalidraw/excalidraw/lasso";
import { AppCursor } from "@excalidraw/excalidraw/components/App.cursor";
import { AppViewport } from "@excalidraw/excalidraw/components/App.viewport";
import { History } from "@excalidraw/excalidraw/history";
import {
  getScrollToContentState,
  getViewportForZoomWithScrollConstraints,
} from "@excalidraw/excalidraw/viewport";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene";
import { Renderer } from "@excalidraw/excalidraw/scene/Renderer";
import rough from "roughjs/bin/rough";

import type {
  EditorInterface,
  EXPORT_IMAGE_TYPES,
  IMAGE_MIME_TYPES,
} from "@excalidraw/common";
import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  FileId,
  NonDeleted,
  NonDeletedExcalidrawElement,
  Theme,
} from "@excalidraw/element/types";
import type { ExportedElements } from "@excalidraw/excalidraw/data";
import type { Mutable, ValueOf } from "@excalidraw/common/utility-types";
import type { ElementUpdate } from "@excalidraw/element";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  InteractionConfig,
  LibraryItems,
  LibraryItemsSource,
  SceneData,
  SidebarName,
  SidebarTabName,
  ToolType,
} from "@excalidraw/excalidraw/types";
import type { SetViewportOptions } from "@excalidraw/excalidraw/viewport";
import type {
  Action,
  ActionResult,
} from "@excalidraw/excalidraw/actions/types";

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
import { actionToggleLinearEditor } from "./actions/actionLinearEditor";
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
  applyElementLinkHoverAffordance,
  getElementLinkAtPosition,
  maybeHandleElementLinkClick,
} from "./link-interaction";
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
import { CaliburnCursorHintComponent } from "./components/cursor-hint.component";
import { CursorHints } from "./components/cursor-hints";
import { CaliburnEyeDropperComponent } from "./components/eye-dropper.component";
import { provideCaliburnIcons } from "./components/icons";
import { CaliburnFrameNameComponent } from "./components/frame-name.component";
import { CaliburnHyperlinkComponent } from "./components/hyperlink/hyperlink.component";
import { CaliburnLayerUIComponent } from "./components/layer-ui.component";
import { CaliburnContextMenuComponent } from "./panel/context-menu.component";
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
  handleLinearEditorPointerUp,
  handleLinearElementOnPointerDown,
  handleMultiElementPointerMove,
  maybeDragLinearPoint,
  maybeSuggestBindingOnHover,
} from "./linear-interaction";
import { cleanupAfterDragOnPointerUp } from "./drag-interaction";
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
  getElementAtPosition,
  handleLassoPointerDown,
  handleSelectionPointerDown,
  handleSelectionPointerMove,
  handleSelectionPointerUp,
  initialPointerDownState,
  isHittingCommonBoundingBoxOfSelectedElements,
  updateActiveLockedIdOnPointerUp,
} from "./selection-interaction";

import type { RoughCanvas } from "roughjs/bin/canvas";

import type { ElementRef, TemplateRef } from "@angular/core";

import type { CommandPaletteItem } from "./components/command-palette/types";
import type { CursorHintView } from "./components/cursor-hints";
import type { EyeDropperProperties } from "./components/eye-dropper";
import type { OverwriteConfirmState } from "./components/overwrite-confirm/overwrite-confirm-state";
import type { PointerDownState } from "./selection-interaction";

import type { AfterViewInit, OnDestroy, OnInit } from "@angular/core";

export interface CaliburnImperativeAPI {
  updateScene: CaliburnEditorComponent["updateScene"];
  mutateElement: CaliburnEditorComponent["mutateElement"];
  updateLibrary: CaliburnEditorComponent["library"]["updateLibrary"];
  toggleSidebar: CaliburnEditorComponent["toggleSidebar"];
  addFiles: (files: BinaryFileData[]) => void;
  getSceneElementsIncludingDeleted: () => readonly ExcalidrawElement[];
  getSceneElementsMapIncludingDeleted: () => ReturnType<
    Scene["getElementsMapIncludingDeleted"]
  >;
  history: { clear: () => void };
  setViewport: AppViewport["setViewport"];
  getViewportOffsets: AppViewport["getOffsets"];
  getSceneElements: () => readonly NonDeletedExcalidrawElement[];
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
}

/** a props snapshot the `interaction` predicates can be evaluated against */
type InteractionProps = {
  interaction?: boolean | InteractionConfig | null;
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
@Component({
  selector: "caliburn-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnContextMenuComponent,
    CaliburnCursorHintComponent,
    CaliburnEyeDropperComponent,
    CaliburnFrameNameComponent,
    CaliburnHyperlinkComponent,
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
  readonly theme = input<Theme | undefined>(undefined);
  readonly onExcalidrawAPI = input<
    ((api: CaliburnImperativeAPI) => void) | null
  >(null);
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
   * `topRightUI` is upstream's `renderTopRightUI` render prop (its one
   * non-tunnel outlet), spelled the same way for consistency.
   */
  readonly mainMenu = input<TemplateRef<unknown> | null>(null);
  readonly welcomeScreenCenter = input<TemplateRef<unknown> | null>(null);
  readonly welcomeScreenMenuHint = input<TemplateRef<unknown> | null>(null);
  readonly welcomeScreenToolbarHint = input<TemplateRef<unknown> | null>(null);
  readonly welcomeScreenHelpHint = input<TemplateRef<unknown> | null>(null);
  readonly footerCenter = input<TemplateRef<unknown> | null>(null);
  readonly topRightUI = input<TemplateRef<unknown> | null>(null);
  readonly sidebar = input<TemplateRef<unknown> | null>(null);

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
    // upstream seeds the scene name at construction, from `props.name` or the
    // dated default (`App.tsx`); caliburn has no `name` prop, so only the
    // default applies
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
  readonly cursorHints = new CursorHints(this);

  /** the mounted `<caliburn-cursor-hint>`, if any (see `CursorHints`) */
  cursorHintView: CursorHintView | null = null;

  /**
   * Upstream keeps the open eye dropper in a module-level jotai atom
   * (`EyeDropper.tsx`'s `activeEyeDropperAtom`) — mirrored here as a
   * per-instance signal, as `activeConfirmDialog` above is.
   */
  readonly activeEyeDropper = signal<EyeDropperProperties | null>(null);

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

  /** the element whose link icon the pointer is currently over, if any */
  hitLinkElement: NonDeletedExcalidrawElement | undefined;

  readonly flowchart = { isCreatingChart: false };

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

  readonly bucketFill = {
    getBucketFillBackgroundColor: (color: string) => color,
  };

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

  readonly drawShape = {
    hasPendingGesture: () => false,
    finalize: () => {},
  };

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
  private pointerDownState: PointerDownState | null = null;

  constructor() {
    // react to the host-controlled props that drive editor state
    // (`props.interaction`, `props.viewModeEnabled`, `props.activeTool`) —
    // the equivalent of upstream's `componentDidUpdate`, whose handlers run
    // in this same order (`App.tsx`)
    effect(() => {
      const interaction = this.interaction();
      const viewModeEnabled = this.viewModeEnabled();
      const forcedTool = this.activeTool();
      const theme = this.theme();
      untracked(() => {
        if (this.unmounted || !this.removeSceneUpdateListener) {
          // pre-mount: `ngOnInit` seeds the initial state from the props
          return;
        }
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

    this.props.libraryReturnUrl = this.libraryReturnUrl();
    this.props.onLibraryChange = this.onLibraryChange() ?? undefined;

    const theme = this.theme();
    this.props.theme = theme;
    this.props.onThemeChange = this.onThemeChange() ?? undefined;
    if (theme) {
      this.state = { ...this.state, theme };
    }
    // upstream normalizes `UIOptions.canvasActions.toggleTheme` from its
    // `null` default to `true` whenever the host controls no theme, or
    // controls it but listens for changes (`index.tsx`)
    if (
      this.props.UIOptions.canvasActions.toggleTheme === null &&
      (theme == null || this.props.onThemeChange)
    ) {
      this.props.UIOptions.canvasActions.toggleTheme = true;
    }

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
    this.cursor.reset();
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
    this.library.destroy();
    this.unsubLibraryItems();
    clearLibraryItemSvgCache();
    this.store.onStoreIncrementEmitter.clear();
    this.history.clear();
    this.store.clear();
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
    this.batchCommits(() => this.onKeyDownImpl(event));
  };

  private onKeyDownImpl = (event: KeyboardEvent) => {
    if (!this.isInteractionEnabled()) {
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
    if (this.maybeHandlePageScrollKeyDown(event)) {
      // the editor consumes the input — the page must not scroll along
      event.preventDefault();
      return;
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

          if (shape === "lasso" && this.state.activeTool.type === "laser") {
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
    const prevState = this.state;
    const partial = typeof state === "function" ? state(this.state) : state;
    if (partial) {
      this.state = { ...this.state, ...partial };
    }
    this.applyStateInvariants();
    this.commit();
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
    this.batchCommits(() => this.handleCanvasPointerDownImpl(event));
  }

  private handleCanvasPointerDownImpl(event: PointerEvent) {
    if (
      !this.isInteractionEnabled() &&
      !this.isToolSupported(this.state.activeTool.type)
    ) {
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

    this.lastPointerDownEvent = event;

    // If Ctrl is not held, ensure isBindingEnabled reflects the user preference.
    if (!event.ctrlKey) {
      const preferenceEnabled = this.state.bindingPreference === "enabled";
      if (this.state.isBindingEnabled !== preferenceEnabled) {
        this.setState({ isBindingEnabled: preferenceEnabled });
      }
    }

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
      if (!this.pointerDownState) {
        // the pointer hit an element's link icon — no gesture starts
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
    } else if (activeToolType === "custom") {
      this.pointerDownState = initialPointerDownState(this, event);
    }

    if (this.pointerDownState) {
      this.onPointerDown()?.(
        this.state.activeTool,
        this.pointerDownState,
        event,
      );
    }
  }

  handleCanvasPointerMove(event: PointerEvent) {
    this.batchCommits(() => this.handleCanvasPointerMoveImpl(event));
  }

  private handleCanvasPointerMoveImpl(event: PointerEvent) {
    if (!this.isInteractionEnabled()) {
      if (this.isNavigationEnabled()) {
        // wheel zoom is anchored on `viewport.lastPosition`
        this.viewport.lastPosition.x = event.clientX;
        this.viewport.lastPosition.y = event.clientY;
        // two-finger pinch zoom/pan (single-pointer panning is handled by
        // the pan session set up on pointerdown)
        updateMultiTouchGesture(this, event);
      }
      return;
    }

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
    const scenePointer = viewportCoordsToSceneCoords(event, this.state);
    maybeUpdateFrameToHighlightOnPointerMove(this, scenePointer);
    this.maybeUpdateHoverCursor(scenePointer, event);
  }

  private maybeUpdateHoverCursor(
    scenePointer: { x: number; y: number },
    event: PointerEvent,
  ) {
    this.hitLinkElement = this.isLinksEnabled()
      ? getElementLinkAtPosition(
          this,
          scenePointer,
          getElementAtPosition(this, scenePointer.x, scenePointer.y, {
            includeLockedElements: true,
          }),
        )
      : undefined;

    if (applyElementLinkHoverAffordance(this)) {
      return;
    }

    const hoveredElement = getElementAtPosition(
      this,
      scenePointer.x,
      scenePointer.y,
    );
    if (
      hoveredElement &&
      (hoveredElement.link || isEmbeddableElement(hoveredElement)) &&
      this.state.selectedElementIds[hoveredElement.id] &&
      !this.state.contextMenu &&
      !this.state.showHyperlinkPopup
    ) {
      this.setState({ showHyperlinkPopup: "info" });
      return;
    }

    if (this.state.viewModeEnabled) {
      this.cursor.set(CURSOR_TYPE.GRAB);
      return;
    }
    if (!isSelectionLikeTool(this.state.activeTool.type)) {
      return;
    }
    const hitElement = getElementAtPosition(
      this,
      scenePointer.x,
      scenePointer.y,
    );
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

  handleCanvasPointerUp(event: PointerEvent) {
    this.batchCommits(() => this.handleCanvasPointerUpImpl(event));
  }

  private handleCanvasPointerUpImpl(event: PointerEvent) {
    // upstream returns early whenever non-interactive: a tool allowed via
    // `interaction.enabled.tools` finishes its stroke through the window
    // listeners its own pointerdown installed. Caliburn drives pointerup
    // off the canvas binding instead, so the allowed tool must reach it.
    if (
      !this.isInteractionEnabled() &&
      !this.isToolSupported(this.state.activeTool.type)
    ) {
      return;
    }

    removePointer(this, event);

    // If Ctrl is not held, ensure isBindingEnabled reflects the user preference.
    this.lastPointerUpEvent = event;

    if (!event.ctrlKey) {
      const preferenceEnabled = this.state.bindingPreference === "enabled";
      if (this.state.isBindingEnabled !== preferenceEnabled) {
        this.setState({ isBindingEnabled: preferenceEnabled });
      }
    }

    if (
      this.isLinksEnabled() &&
      maybeHandleElementLinkClick(
        this,
        viewportCoordsToSceneCoords(event, this.state),
      )
    ) {
      this.pointerDownState = null;
      return;
    }

    if (this.pointerDownState) {
      this.onPointerUp()?.(this.state.activeTool, this.pointerDownState, event);
      if (this.state.activeTool.type === "custom") {
        this.clearHighlightsOnPointerUp();
        this.pointerDownState = null;
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
        handleSelectionPointerUp(this, this.pointerDownState, event);
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

  private clearHighlightsOnPointerUp() {
    if (this.state.frameToHighlight || this.state.elementsToHighlight) {
      this.setState({ frameToHighlight: null, elementsToHighlight: null });
    }
  }

  getApi(): CaliburnImperativeAPI {
    return {
      updateScene: this.updateScene,
      mutateElement: this.mutateElement,
      updateLibrary: this.library.updateLibrary,
      toggleSidebar: this.toggleSidebar,
      addFiles: (files: BinaryFileData[]) => {
        this.addMissingFiles(files);
        addNewImagesToImageCache(this);
        this.scene.triggerUpdate();
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
    return this.state.name || `${t("labels.untitled")}-${getDateTime()}`;
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
    // relies on. `resetGesture` runs the pan session's own teardown — the
    // only window-level listeners caliburn installs (pointermove/pointerup/
    // blur, see `pan-gesture.ts`) — and clears the multi-touch gesture;
    // dropping `pointerDownState` ends the in-flight drag so it can't
    // resume once interaction returns (upstream's
    // `maybeCleanupAfterMissingPointerUp` + `isPanning`/`gesture` resets).
    resetGesture();
    this.pointerDownState = null;
    resetPlainPasteTracking();

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

  requestUnfollow() {}

  refreshEditorInterface() {}

  refresh() {}

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
    for (const element of this.scene.getNonDeletedElements()) {
      if (
        isEmbeddableElement(element) &&
        !this.embedsValidationStatus.has(element.id)
      ) {
        this.embedsValidationStatus.set(
          element.id,
          embeddableURLValidator(element.link, undefined),
        );
        ShapeCache.delete(element);
      }
    }
  }

  private commit() {
    if (this.batchDepth > 0) {
      this.commitPending = true;
      return;
    }
    this.changeGeneration.update((generation) => generation + 1);
    this.updateEmbeddables();
    // assigned rather than `setState`d, which would re-enter this commit; the
    // flag is not observed by the store, so the delta is unaffected either way
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
  }
}
