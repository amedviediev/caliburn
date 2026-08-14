import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  input,
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

import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { History } from "@excalidraw/excalidraw/history";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { Mutable } from "@excalidraw/common/utility-types";
import type { ElementUpdate } from "@excalidraw/element";
import type {
  AppState,
  SceneData,
  ToolType,
} from "@excalidraw/excalidraw/types";

import { createTestHook } from "./test-hook";
import {
  handleSelectionPointerDown,
  handleSelectionPointerMove,
  handleSelectionPointerUp,
} from "./selection-interaction";

import type { PointerDownState } from "./selection-interaction";

import type { OnDestroy, OnInit } from "@angular/core";

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
    <div class="excalidraw excalidraw-container">
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
export class CaliburnEditorComponent implements OnInit, OnDestroy {
  readonly handleKeyboardGlobally = input(false);
  readonly initialData = input<{
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
  } | null>(null);

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

    const initialData = this.initialData();
    if (initialData) {
      if (initialData.appState) {
        this.state = { ...this.state, ...initialData.appState };
      }
      if (initialData.elements) {
        this.scene.replaceAllElements(syncInvalidIndices(initialData.elements));
      }
    }

    this.commit();
  }

  ngOnDestroy() {
    this.removeSceneUpdateListener?.();
    this.removeSceneUpdateListener = null;
    this.store.onStoreIncrementEmitter.clear();
    this.history.clear();
    this.store.clear();
    this.scene.destroy();
  }

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

  refreshEditorInterface() {}

  refresh() {}

  private commit() {
    this.store.commit(this.scene.getElementsMapIncludingDeleted(), this.state);
  }
}
