import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  input,
  viewChild,
} from "@angular/core";

import { TOOL_TYPE, updateActiveTool } from "@excalidraw/common";
import {
  Scene,
  Store,
  getObservedAppState,
  isElementInGroup,
  makeNextSelectedElementIds,
  syncInvalidIndices,
} from "@excalidraw/element";

import { KEYS } from "@excalidraw/common";

import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { AppViewport } from "@excalidraw/excalidraw/components/App.viewport";
import { History } from "@excalidraw/excalidraw/history";
import { getScrollToContentState } from "@excalidraw/excalidraw/viewport";

import type { ElementRef } from "@angular/core";
import type { EditorInterface } from "@excalidraw/common";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { Mutable } from "@excalidraw/common/utility-types";
import type { ElementUpdate } from "@excalidraw/element";
import type {
  AppState,
  SceneData,
  ToolType,
} from "@excalidraw/excalidraw/types";
import type { SetViewportOptions } from "@excalidraw/excalidraw/viewport";

import { createTestHook } from "./test-hook";
import {
  handleSelectionPointerDown,
  handleSelectionPointerMove,
  handleSelectionPointerUp,
} from "./selection-interaction";

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
  template: `
    <div #container class="excalidraw excalidraw-container">
      <div class="App-toolbar">
        @for (tool of toolbarTools; track tool) {
        <button
          type="button"
          [attr.data-testid]="'toolbar-' + tool"
          [attr.aria-label]="tool"
          (click)="setActiveTool({ type: tool })"
        ></button>
        }
        <button
          type="button"
          data-testid="toolbar-lock"
          aria-label="lock"
          (click)="toggleToolLock()"
        ></button>
      </div>
      <canvas class="excalidraw__canvas static"></canvas>
      <canvas
        class="excalidraw__canvas interactive"
        (pointerdown)="handleCanvasPointerDown($event)"
        (pointermove)="handleCanvasPointerMove($event)"
        (pointerup)="handleCanvasPointerUp($event)"
      ></canvas>
    </div>
  `,
})
export class CaliburnEditorComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  readonly handleKeyboardGlobally = input(false);
  readonly initialData = input<{
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    scrollToContent?: boolean;
  } | null>(null);
  readonly initialState = input<{
    viewport?: Omit<SetViewportOptions, "animation">;
  } | null>(null);

  readonly containerRef = viewChild<ElementRef<HTMLDivElement>>("container");

  readonly toolbarTools = TOOLBAR_TOOLS;

  state: AppState = {
    ...getDefaultAppState(),
    offsetLeft: 0,
    offsetTop: 0,
    width: 0,
    height: 0,
  };

  readonly scene = new Scene();
  readonly store = new Store(this as any);
  readonly history = new History(this.store);

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
    isGestureActive: () => false,
  });

  readonly actionManager = {
    executeAction: (_action: unknown): void => {
      throw new Error("actionManager is not ported yet");
    },
  };

  private readonly cdr = inject(ChangeDetectorRef);
  private removeSceneUpdateListener: (() => void) | null = null;
  private pointerDownState: PointerDownState | null = null;

  constructor() {
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
    this.store.onDurableIncrementEmitter.on((increment) => {
      this.history.record(increment.delta);
    });
    this.removeSceneUpdateListener = this.scene.onUpdate(() => {
      this.commit();
      this.cdr.detectChanges();
    });

    if (this.handleKeyboardGlobally()) {
      document.addEventListener("keydown", this.onKeyDown);
    }

    this.commit();
  }

  ngAfterViewInit() {
    this.updateDOMRect();
    this.initializeScene();
  }

  ngOnDestroy() {
    this.unmounted = true;
    document.removeEventListener("keydown", this.onKeyDown);
    this.removeSceneUpdateListener?.();
    this.removeSceneUpdateListener = null;
    this.store.onStoreIncrementEmitter.clear();
    this.history.clear();
    this.store.clear();
    this.scene.destroy();
  }

  private initializeScene() {
    const initialData = this.initialData();
    if (initialData?.appState) {
      this.setState(initialData.appState);
    }
    if (initialData?.elements) {
      this.scene.replaceAllElements(syncInvalidIndices(initialData.elements));
    }

    const initialViewport = this.initialState()?.viewport;
    if (initialViewport) {
      const initialViewportState = this.viewport.resolveInitialViewport(
        initialViewport,
        this.scene.getNonDeletedElementsMap(),
        this.state,
      );
      if (initialViewportState) {
        this.setState({ ...initialViewportState });
      }
    } else if (initialData?.scrollToContent) {
      this.setState(
        getScrollToContentState(this.scene.getNonDeletedElements(), this.state),
      );
    }
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
    if (this.maybeHandlePageScrollKeyDown(event)) {
      // the editor consumes the input — the page must not scroll along
      event.preventDefault();
    }
  };

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
    const partial = typeof state === "function" ? state(this.state) : state;
    if (partial) {
      this.state = { ...this.state, ...partial };
    }
    this.commit();
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

  setActiveTool(
    tool: { type: ToolType } | { type: "custom"; customType: string },
  ) {
    this.setState({
      activeTool: updateActiveTool(this.state, tool),
    });
  }

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

  handleCanvasPointerDown(event: PointerEvent) {
    if (this.state.activeTool.type === "selection") {
      this.pointerDownState = handleSelectionPointerDown(this, event);
    }
  }

  handleCanvasPointerMove(event: PointerEvent) {
    if (this.pointerDownState) {
      handleSelectionPointerMove(this, this.pointerDownState, event);
    }
  }

  handleCanvasPointerUp(_event: PointerEvent) {
    if (this.pointerDownState) {
      handleSelectionPointerUp(this, this.pointerDownState);
      this.pointerDownState = null;
    }
  }

  requestUnfollow() {}

  refreshEditorInterface() {}

  refresh() {}

  private commit() {
    this.store.commit(this.scene.getElementsMapIncludingDeleted(), this.state);
  }
}
