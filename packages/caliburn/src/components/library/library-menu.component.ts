import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  signal,
  untracked,
} from "@angular/core";

import {
  CLASSES,
  EVENT,
  KEYS,
  LIBRARY_DISABLED_TYPES,
  addEventListener,
  isShallowEqual,
  isWritableElement,
  randomId,
} from "@excalidraw/common";

import { getSelectedElements } from "@excalidraw/element";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { distributeLibraryItemsOnSquareGrid } from "@excalidraw/excalidraw/data/library";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { LibraryItem, LibraryItems } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnSpinnerComponent } from "../spinner.component";

import { translated } from "../../i18n";

import { CaliburnLibraryMenuControlButtonsComponent } from "./library-menu-control-buttons.component";
import { CaliburnLibraryMenuItemsComponent } from "./library-menu-items.component";

import type { CaliburnEditorComponent } from "../../editor.component";
import type { OnDestroy } from "@angular/core";

/**
 * Angular port of upstream `LibraryMenu.tsx` — its `LibraryMenu`,
 * `LibraryMenuContent` and `LibraryMenuWrapper` in one component (the split
 * upstream is `memo` boundaries, which Angular's `OnPush` + signals give for
 * free). The host element IS upstream's `.layer-ui__library` wrapper.
 *
 * Upstream's `usePendingElementsMemo` is the `syncPendingElements` effect: it
 * keeps the "add selected elements to library" preview stable while a pointer
 * gesture is in flight, and re-reads it once the selection or a selected
 * element's version changes.
 */
@Component({
  selector: "caliburn-library-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnLibraryMenuControlButtonsComponent,
    CaliburnLibraryMenuItemsComponent,
    CaliburnSpinnerComponent,
  ],
  host: { class: "layer-ui__library" },
  templateUrl: "./library-menu.component.html",
})
export class CaliburnLibraryMenuComponent implements OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly loadingMessage = translated(() =>
    t("labels.libraryLoadingMessage"),
  );

  protected readonly selectedItems = signal<LibraryItem["id"][]>([]);
  protected readonly pendingElements = signal<LibraryItem["elements"]>([]);

  private selectedElementIdsSnapshot: Record<string, boolean> = {};
  private readonly selectedElementVersions = new Map<
    ExcalidrawElement["id"],
    ExcalidrawElement["version"]
  >();

  protected readonly libraryItemsData = this.editor.libraryItemsData;

  protected readonly isInitializing = computed(
    () =>
      this.libraryItemsData().status === "loading" &&
      !this.libraryItemsData().isInitialized,
  );

  protected readonly isLoading = computed(
    () => this.libraryItemsData().status === "loading",
  );

  protected readonly libraryItems = computed(
    () => this.libraryItemsData().libraryItems,
  );

  protected readonly showControlButtons = computed(
    () => this.libraryItems().length > 0 || this.pendingElements().length > 0,
  );

  protected readonly theme = computed(() => {
    this.editor.changeGeneration();
    return this.editor.state.theme;
  });

  protected readonly id = this.editor.id;
  protected readonly libraryReturnUrl = this.editor.props.libraryReturnUrl;

  private readonly detachKeyDown = addEventListener(
    document,
    EVENT.KEYDOWN,
    (event: Event) => this.onKeyDown(event as KeyboardEvent),
    { capture: true },
  );

  private readonly syncPendingElements = effect(() => {
    this.editor.changeGeneration();
    untracked(() => this.updatePendingElements());
  });

  ngOnDestroy() {
    this.detachKeyDown();
  }

  protected onInsertLibraryItems(libraryItems: LibraryItems) {
    this.editor.onInsertElements(
      distributeLibraryItemsOnSquareGrid(libraryItems),
    );
    this.editor.focusContainer();
  }

  protected onAddToLibrary(elements: LibraryItem["elements"]) {
    trackEvent("element", "addToLibrary", "ui");
    for (const type of LIBRARY_DISABLED_TYPES) {
      if (elements.some((element) => element.type === type)) {
        this.editor.batchCommits(() =>
          this.editor.setState({
            errorMessage: t(`errors.libraryElementTypeError.${type}`),
          }),
        );
        return;
      }
    }

    const nextItems: LibraryItems = [
      {
        status: "unpublished",
        elements,
        id: randomId(),
        created: Date.now(),
      },
      ...this.libraryItems(),
    ];

    // upstream's `onAddToLibrary` prop (LibraryMenu's `deselectItems`)
    this.editor.batchCommits(() =>
      this.editor.setState({
        selectedElementIds: {},
        selectedGroupIds: {},
        activeEmbeddable: null,
      }),
    );

    this.editor.library.setLibrary(nextItems).catch(() => {
      this.editor.batchCommits(() =>
        this.editor.setState({
          errorMessage: t("alerts.errorAddingToLibrary"),
        }),
      );
    });
  }

  private getPendingElements() {
    return getSelectedElements(
      this.editor.scene.getNonDeletedElements(),
      { selectedElementIds: this.editor.state.selectedElementIds },
      {
        includeBoundTextElement: true,
        includeElementsInFrames: true,
      },
    );
  }

  private setPendingElements(pending: LibraryItem["elements"]) {
    this.pendingElements.set(pending);
    this.selectedElementIdsSnapshot = this.editor.state.selectedElementIds;
    for (const element of pending) {
      this.selectedElementVersions.set(element.id, element.version);
    }
  }

  private updatePendingElements() {
    const { selectedElementIds } = this.editor.state;

    if (
      // Only update once pointer is released.
      this.editor.state.cursorButton !== "up" ||
      this.editor.state.activeTool.type !== "selection"
    ) {
      return;
    }

    // if selectedElementIds changed, we don't have to compare versions
    if (!isShallowEqual(this.selectedElementIdsSnapshot, selectedElementIds)) {
      this.selectedElementVersions.clear();
      this.setPendingElements(this.getPendingElements());
      return;
    }

    // otherwise we need to check whether selected elements changed
    const elementsMap = this.editor.scene.getNonDeletedElementsMap();
    for (const id of Object.keys(selectedElementIds)) {
      const currVersion = elementsMap.get(id)?.version;
      if (currVersion && currVersion !== this.selectedElementVersions.get(id)) {
        this.setPendingElements(this.getPendingElements());
        return;
      }
    }
  }

  private onKeyDown(event: KeyboardEvent) {
    if (event.key !== KEYS.ESCAPE || !(event.target instanceof HTMLElement)) {
      return;
    }
    const target = event.target;
    if (target.closest(`.${CLASSES.SIDEBAR}`)) {
      // stop propagation so that we don't prevent it downstream
      // (default browser behavior is to clear search input on ESC)
      if (this.selectedItems().length > 0) {
        event.stopPropagation();
        this.selectedItems.set([]);
      } else if (
        isWritableElement(target) &&
        target instanceof HTMLInputElement &&
        !target.value
      ) {
        event.stopPropagation();
        // if search input empty -> close library
        // (maybe not a good idea?)
        this.editor.batchCommits(() =>
          this.editor.setState({ openSidebar: null }),
        );
        this.editor.focusContainer();
      }
    } else if (this.selectedItems().length > 0) {
      const { x, y } = this.editor.viewport.lastPosition;
      const elementUnderCursor = document.elementFromPoint(x, y);
      // also deselect elements if sidebar doesn't have focus but the
      // cursor is over it
      if (elementUnderCursor?.closest(`.${CLASSES.SIDEBAR}`)) {
        event.stopPropagation();
        this.selectedItems.set([]);
      }
    }
  }
}
