import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

import { MIME_TYPES, arrayToMap, nextAnimationFrame } from "@excalidraw/common";

import { duplicateElements } from "@excalidraw/element";

import { deburr } from "@excalidraw/excalidraw/deburr";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawLibraryIds } from "@excalidraw/excalidraw/data/types";
import type {
  AppState,
  LibraryItem,
  LibraryItems,
} from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnButtonComponent } from "../button.component";
import { CaliburnSpinnerComponent } from "../spinner.component";
import { CaliburnStackColComponent } from "../stack.component";
import { CaliburnTextFieldComponent } from "../text-field.component";

import { translated } from "../../i18n";

import { CaliburnLibraryDropdownMenuComponent } from "./library-dropdown-menu.component";
import { libraryItemSvgCache } from "./library-item-svg";
import { CaliburnLibraryMenuControlButtonsComponent } from "./library-menu-control-buttons.component";
import { CaliburnLibraryMenuSectionComponent } from "./library-menu-section.component";

import type { CaliburnEditorComponent } from "../../editor.component";
import type { AfterViewInit, OnDestroy } from "@angular/core";

// using an odd number of items per batch so the rendering creates an irregular
// pattern which looks more organic
const ITEMS_RENDERED_PER_BATCH = 17;
// when render outputs cached we can render many more items per batch to
// speed it up
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;

const SCROLL_THROTTLE_MS = 200;

/**
 * Upstream keeps the library list's scroll offset in a module-level jotai atom
 * (`hooks/useScrollPosition.ts`) so it survives the menu unmounting with the
 * sidebar tab — a module-level value here for the same reason.
 */
let lastScrollPosition = 0;

/**
 * Angular port of upstream `LibraryMenuItems.tsx`. The host element IS
 * upstream's `.library-menu-items-container` div.
 */
@Component({
  selector: "caliburn-library-menu-items",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnButtonComponent,
    CaliburnLibraryDropdownMenuComponent,
    CaliburnLibraryMenuControlButtonsComponent,
    CaliburnLibraryMenuSectionComponent,
    CaliburnSpinnerComponent,
    CaliburnStackColComponent,
    CaliburnTextFieldComponent,
  ],
  host: {
    class: "library-menu-items-container",
    "[style.justify-content]": "hasAnyItems() ? 'flex-start' : null",
    "[style.border-bottom]": "hasAnyItems() ? null : 0",
  },
  templateUrl: "./library-menu-items.component.html",
})
export class CaliburnLibraryMenuItemsComponent
  implements AfterViewInit, OnDestroy
{
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly isLoading = input.required<boolean>();
  readonly libraryItems = input.required<LibraryItems>();
  readonly pendingElements = input.required<LibraryItem["elements"]>();
  readonly theme = input.required<AppState["theme"]>();
  readonly id = input.required<string>();
  readonly libraryReturnUrl = input<string>();
  readonly selectedItems = model.required<LibraryItem["id"][]>();

  readonly addToLibrary = output<LibraryItem["elements"]>();
  readonly insertLibraryItems = output<LibraryItems>();

  protected readonly personalLibLabel = translated(() =>
    t("labels.personalLib"),
  );
  protected readonly excalidrawLibLabel = translated(() =>
    t("labels.excalidrawLib"),
  );
  protected readonly noItemsLabel = translated(() => t("library.noItems"));
  protected readonly emptyPrivateHint = translated(() =>
    t("library.hint_emptyPrivateLibrary"),
  );
  protected readonly emptyLibraryHint = translated(() =>
    t("library.hint_emptyLibrary"),
  );
  protected readonly searchHeading = translated(() =>
    t("library.search.heading"),
  );
  protected readonly searchNoResults = translated(() =>
    t("library.search.noResults"),
  );
  protected readonly searchClear = translated(() =>
    t("library.search.clearSearch"),
  );
  protected readonly searchPlaceholder = translated(() =>
    t("library.search.inputPlaceholder"),
  );
  protected readonly isPhone =
    this.editor.editorInterface.formFactor === "phone";

  protected readonly searchInputValue = signal("");
  private readonly lastSelectedItem = signal<LibraryItem["id"] | null>(null);

  private readonly libraryContainer = viewChild.required<
    unknown,
    ElementRef<HTMLElement>
  >("libraryContainer", { read: ElementRef });
  private readonly searchInput = viewChild(CaliburnTextFieldComponent);

  protected readonly isLibraryEmpty = computed(
    () => !this.libraryItems().length && !this.pendingElements().length,
  );

  protected readonly isSearching = computed(
    () => !this.isLibraryEmpty() && !!this.searchInputValue().trim(),
  );

  protected readonly filteredItems = computed(() => {
    const searchQuery = deburr(this.searchInputValue().trim().toLowerCase());
    if (!searchQuery) {
      return [];
    }

    return this.libraryItems().filter((item) => {
      const itemName = item.name || "";
      return (
        itemName.trim() && deburr(itemName.toLowerCase()).includes(searchQuery)
      );
    });
  });

  protected readonly unpublishedItems = computed(() =>
    this.libraryItems().filter((item) => item.status !== "published"),
  );

  protected readonly publishedItems = computed(() =>
    this.libraryItems().filter((item) => item.status === "published"),
  );

  protected readonly hasAnyItems = computed(
    () =>
      !!this.pendingElements().length ||
      !!this.unpublishedItems().length ||
      !!this.publishedItems().length,
  );

  protected readonly pendingItems = computed(() => [
    { id: null, elements: this.pendingElements() },
  ]);

  protected readonly itemsRenderedPerBatch = computed(() => {
    const items = this.filteredItems().length
      ? this.filteredItems()
      : this.libraryItems();
    return libraryItemSvgCache.size >= items.length
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;
  });

  protected readonly isItemSelected = computed(() => {
    const selected = this.selectedItems();
    return (id: LibraryItem["id"] | null) =>
      id ? selected.includes(id) : false;
  });

  private readonly resetLastSelectedItem = effect(() => {
    // if selection is removed (e.g. via esc), reset last selected item
    // so that subsequent shift+clicks don't select a large range
    if (!this.selectedItems().length) {
      untracked(() => this.lastSelectedItem.set(null));
    }
  });

  private lastScrollRecordedAt = 0;

  /** upstream throttles the same write through `lodash.throttle` (a
   * `packages/excalidraw` dependency caliburn doesn't carry) */
  private readonly onScroll = () => {
    const now = Date.now();
    if (now - this.lastScrollRecordedAt < SCROLL_THROTTLE_MS) {
      return;
    }
    this.lastScrollRecordedAt = now;
    lastScrollPosition = this.libraryContainer().nativeElement.scrollTop;
  };

  ngAfterViewInit() {
    if (lastScrollPosition > 0) {
      this.libraryContainer().nativeElement.scrollTo(0, lastScrollPosition);
    }
    this.libraryContainer().nativeElement.addEventListener(
      "scroll",
      this.onScroll,
    );

    // focus could be stolen by tab trigger button
    nextAnimationFrame(() => {
      this.searchInput()?.focus();
    });
  }

  ngOnDestroy() {
    this.libraryContainer().nativeElement.removeEventListener(
      "scroll",
      this.onScroll,
    );
  }

  protected onItemSelectToggle({
    id,
    event,
  }: {
    id: LibraryItem["id"];
    event: MouseEvent;
  }) {
    const selectedItems = this.selectedItems();
    const shouldSelect = !selectedItems.includes(id);
    const orderedItems = [...this.unpublishedItems(), ...this.publishedItems()];
    const lastSelectedItem = this.lastSelectedItem();

    if (shouldSelect) {
      if (event.shiftKey && lastSelectedItem) {
        const rangeStart = orderedItems.findIndex(
          (item) => item.id === lastSelectedItem,
        );
        const rangeEnd = orderedItems.findIndex((item) => item.id === id);

        if (rangeStart === -1 || rangeEnd === -1) {
          this.selectedItems.set([...selectedItems, id]);
          return;
        }

        const selectedItemsMap = arrayToMap(selectedItems);
        // Support both top-down and bottom-up selection by using min/max
        const minRange = Math.min(rangeStart, rangeEnd);
        const maxRange = Math.max(rangeStart, rangeEnd);
        const nextSelectedIds = orderedItems.reduce(
          (acc: LibraryItem["id"][], item, idx) => {
            if (
              (idx >= minRange && idx <= maxRange) ||
              selectedItemsMap.has(item.id)
            ) {
              acc.push(item.id);
            }
            return acc;
          },
          [],
        );
        this.selectedItems.set(nextSelectedIds);
      } else {
        this.selectedItems.set([...selectedItems, id]);
      }
      this.lastSelectedItem.set(id);
    } else {
      this.lastSelectedItem.set(null);
      this.selectedItems.set(selectedItems.filter((_id) => _id !== id));
    }
  }

  protected onItemDrag({
    id,
    event,
  }: {
    id: LibraryItem["id"];
    event: DragEvent;
  }) {
    // we want to serialize just the ids so the operation is fast and there's
    // no race condition if people drop the library items on canvas too fast
    const selectedItems = this.selectedItems();
    const data: ExcalidrawLibraryIds = {
      itemIds: selectedItems.includes(id) ? selectedItems : [id],
    };
    event.dataTransfer?.setData(
      MIME_TYPES.excalidrawlibIds,
      JSON.stringify(data),
    );
  }

  protected onAddToLibraryClick() {
    this.addToLibrary.emit(this.pendingElements());
  }

  protected onItemClick(id: LibraryItem["id"] | null) {
    if (id) {
      this.insertLibraryItems.emit(this.getInsertedElements(id));
    }
  }

  protected clearSearch() {
    this.searchInputValue.set("");
  }

  protected preventDefault(event: Event) {
    event.preventDefault();
  }

  private getInsertedElements(id: string): LibraryItems {
    const selectedItems = this.selectedItems();
    const libraryItems = this.libraryItems();
    let targetElements;
    if (selectedItems.includes(id)) {
      targetElements = libraryItems.filter((item) =>
        selectedItems.includes(item.id),
      );
    } else {
      targetElements = libraryItems.filter((item) => item.id === id);
    }
    return targetElements.map((item) => {
      return {
        ...item,
        // duplicate each library item before inserting on canvas to confine
        // ids and bindings to each library item. See #6465
        elements: duplicateElements({
          type: "everything",
          elements: item.elements,
          randomizeSeed: true,
          preserveFrameChildrenOrder: true,
        }).duplicatedElements,
      };
    });
  }
}
