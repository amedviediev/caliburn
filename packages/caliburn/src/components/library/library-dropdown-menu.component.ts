import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  forwardRef,
  inject,
  model,
  signal,
} from "@angular/core";

import { muteFSAbortError } from "@excalidraw/common";

import { fileOpen } from "@excalidraw/excalidraw/data/filesystem";
import { saveLibraryAsJSON } from "@excalidraw/excalidraw/data/json";
import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import type { LibraryItem } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnConfirmDialogComponent } from "../confirm-dialog.component";
import { CaliburnDropdownMenuContentComponent } from "../dropdown-menu/dropdown-menu-content.component";
import { CaliburnDropdownMenuItemComponent } from "../dropdown-menu/dropdown-menu-item.component";
import { CaliburnDropdownMenuTriggerComponent } from "../dropdown-menu/dropdown-menu-trigger.component";
import { CaliburnDropdownMenuComponent } from "../dropdown-menu/dropdown-menu.component";

import { translated } from "../../i18n";

import {
  clearLibraryItemSvgCache,
  deleteItemsFromLibraryItemSvgCache,
} from "./library-item-svg";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `LibraryMenuHeaderContent.tsx` — its
 * `LibraryDropdownMenu` (which only reads the library off the app and hands
 * it down) and `LibraryDropdownMenuButton` (the markup) collapsed into one
 * component, since the split exists upstream only to separate the data lookup
 * from the presentation.
 *
 * The publish-to-libraries.excalidraw.com flow (`PublishLibrary`, the
 * `buttons.publishLibrary` item and the publish-success dialog) is
 * intentionally absent — it is upstream-brand infrastructure. The "Browse
 * libraries" link is kept exactly as upstream renders it
 * (`LibraryMenuBrowseButton.tsx`).
 *
 * Upstream's `isLibraryMenuOpenAtom` is a plain per-instance signal here: it
 * is per-editor state that no other caliburn surface reads.
 */
@Component({
  selector: "caliburn-library-dropdown-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnConfirmDialogComponent,
    CaliburnDropdownMenuComponent,
    CaliburnDropdownMenuContentComponent,
    CaliburnDropdownMenuItemComponent,
    CaliburnDropdownMenuTriggerComponent,
    NgIcon,
  ],
  host: { class: "library-menu-dropdown-container" },
  templateUrl: "./library-dropdown-menu.component.html",
})
export class CaliburnLibraryDropdownMenuComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );
  private readonly cdr = inject(ChangeDetectorRef);

  readonly selectedItems = model.required<LibraryItem["id"][]>();

  protected readonly loadLabel = translated(() => t("buttons.load"));
  protected readonly exportLabel = translated(() => t("buttons.export"));
  protected readonly removeLabel = translated(() => t("buttons.remove"));
  protected readonly resetLibraryLabel = translated(() =>
    t("buttons.resetLibrary"),
  );

  protected readonly isLibraryMenuOpen = signal(false);
  protected readonly showRemoveLibAlert = signal(false);

  protected readonly itemsSelected = computed(
    () => !!this.selectedItems().length,
  );

  protected readonly items = computed(() => {
    const libraryItems = this.editor.libraryItemsData().libraryItems;
    return this.itemsSelected()
      ? libraryItems.filter((item) => this.selectedItems().includes(item.id))
      : libraryItems;
  });

  protected readonly resetLabel = computed(() =>
    this.itemsSelected() ? this.removeLabel : this.resetLibraryLabel,
  );

  protected readonly alertTitle = computed(() =>
    this.selectedItems().length
      ? t("confirmDialog.removeItemsFromLib")
      : t("confirmDialog.resetLibrary"),
  );

  protected readonly alertContent = computed(() =>
    this.selectedItems().length
      ? t("alerts.removeItemsFromsLibrary", {
          count: this.selectedItems().length,
        })
      : t("alerts.resetLibrary"),
  );

  /**
   * The open flag is component-local (upstream's `isLibraryMenuOpenAtom`), so
   * nothing in the editor's commit path refreshes this view — the pass is
   * forced here so the menu's items are in the DOM by the time the click that
   * opened it returns, the way React's state update is flushed.
   */
  protected setMenuOpen(open: boolean) {
    this.isLibraryMenuOpen.set(open);
    this.cdr.detectChanges();
  }

  protected onConfirmRemove() {
    if (this.selectedItems().length) {
      this.removeFromLibrary();
    } else {
      this.resetLibrary();
    }
    this.showRemoveLibAlert.set(false);
  }

  protected async onLibraryImport() {
    try {
      await this.editor.library.updateLibrary({
        libraryItems: fileOpen({
          description: "Excalidraw library files",
          // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
          // gets resolved. Else, iOS users cannot open `.excalidraw` files.
          /*
            extensions: [".json", ".excalidrawlib"],
            */
        }),
        merge: true,
        openLibraryMenu: true,
      });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.warn(error);
        return;
      }
      this.setErrorMessage(t("errors.importLibraryError"));
    }
  }

  protected async onLibraryExport() {
    const libraryItems = this.itemsSelected()
      ? this.items()
      : await this.editor.library.getLatestLibrary();
    saveLibraryAsJSON(libraryItems)
      .catch(muteFSAbortError)
      .catch((error) => {
        this.setErrorMessage(error.message);
      });
  }

  private removeFromLibrary() {
    const selected = this.selectedItems();
    const nextItems = this.editor
      .libraryItemsData()
      .libraryItems.filter((item) => !selected.includes(item.id));

    this.editor.library.setLibrary(nextItems).catch(() => {
      this.setErrorMessage(t("alerts.errorRemovingFromLibrary"));
    });

    deleteItemsFromLibraryItemSvgCache(selected);

    this.selectedItems.set([]);
  }

  private resetLibrary() {
    this.editor.library.resetLibrary();
    clearLibraryItemSvgCache();
  }

  private setErrorMessage(errorMessage: string) {
    this.editor.batchCommits(() => this.editor.setState({ errorMessage }));
  }
}
