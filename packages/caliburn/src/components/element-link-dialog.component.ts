import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";

import { KEYS, normalizeLink } from "@excalidraw/common";
import {
  defaultGetElementLinkFromSelection,
  getLinkIdAndTypeFromSelection,
} from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";
import { getSelectedElements } from "@excalidraw/excalidraw/scene";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnDialogActionButtonComponent } from "./dialog-action-button.component";
import { CaliburnIconButtonComponent } from "./icon-button.component";
import { CaliburnTextFieldComponent } from "./text-field.component";

import type { CaliburnEditorComponent } from "../editor.component";

import type { OnDestroy, OnInit } from "@angular/core";

/**
 * Angular port of upstream `ElementLinkDialog.tsx` — the link-to-element
 * picker: the link the current selection resolves to, with confirm / cancel
 * / remove.
 *
 * Upstream's `generateLinkForSelection` prop has no caliburn equivalent, so
 * the link is always `defaultGetElementLinkFromSelection`.
 */
@Component({
  selector: "caliburn-element-link-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnDialogActionButtonComponent,
    CaliburnIconButtonComponent,
    CaliburnTextFieldComponent,
  ],
  templateUrl: "./element-link-dialog.component.html",
})
export class CaliburnElementLinkDialogComponent implements OnInit, OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly sourceElementId = input.required<ExcalidrawElement["id"]>();

  protected readonly title = t("elementLink.title");
  protected readonly desc = t("elementLink.desc");
  protected readonly removeLabel = t("buttons.remove");
  protected readonly cancelLabel = t("buttons.cancel");
  protected readonly confirmLabel = t("buttons.confirm");

  protected readonly nextLink = signal<string | null>(null);
  private linkEdited = false;

  protected readonly originalLink = computed(() => {
    this.editor.changeGeneration();
    return (
      this.editor.scene.getNonDeletedElementsMap().get(this.sourceElementId())
        ?.link ?? null
    );
  });

  /** upstream recomputes the link whenever the selection changes */
  private readonly trackSelection = effect(() => {
    this.editor.changeGeneration();
    const elementsMap = this.editor.scene.getNonDeletedElementsMap();
    const selectedElements = getSelectedElements(
      elementsMap,
      this.editor.state,
    );
    let nextLink = this.originalLink();

    if (selectedElements.length > 0) {
      const idAndType = getLinkIdAndTypeFromSelection(
        selectedElements,
        this.editor.state,
      );

      if (idAndType) {
        nextLink = normalizeLink(
          defaultGetElementLinkFromSelection(idAndType.id, idAndType.type),
        );
      }
    }

    this.nextLink.set(nextLink);
  });

  ngOnInit() {
    window.addEventListener("keydown", this.onWindowKeyDown);
  }

  ngOnDestroy() {
    window.removeEventListener("keydown", this.onWindowKeyDown);
  }

  protected onLinkChange(value: string) {
    if (!this.linkEdited) {
      this.linkEdited = true;
    }
    this.nextLink.set(value);
  }

  protected onKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.ENTER) {
      this.onConfirm();
    }
  }

  protected readonly onRemove = () => {
    // removes the link from the input but doesn't update the element;
    // when confirmed, will remove the link from the element
    this.nextLink.set(null);
    this.linkEdited = true;
  };

  protected onConfirm() {
    const elementsMap = this.editor.scene.getNonDeletedElementsMap();
    const sourceElementId = this.sourceElementId();
    const nextLink = this.nextLink();

    if (nextLink && nextLink !== elementsMap.get(sourceElementId)?.link) {
      const elementToLink = elementsMap.get(sourceElementId);
      elementToLink &&
        this.editor.scene.mutateElement(elementToLink, { link: nextLink });
    }

    if (!nextLink && this.linkEdited && sourceElementId) {
      const elementToLink = elementsMap.get(sourceElementId);
      elementToLink &&
        this.editor.scene.mutateElement(elementToLink, { link: null });
    }

    this.onClose();
  }

  protected onClose() {
    this.editor.batchCommits(() => this.editor.setState({ openDialog: null }));
  }

  private readonly onWindowKeyDown = (event: KeyboardEvent) => {
    if (this.editor.state.openDialog?.name !== "elementLinkSelector") {
      return;
    }
    if (event.key === KEYS.ENTER) {
      this.onConfirm();
    }
    if (event.key === KEYS.ESCAPE) {
      this.onClose();
    }
  };
}
