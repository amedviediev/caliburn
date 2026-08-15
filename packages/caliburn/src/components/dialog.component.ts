import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from "@angular/core";

import clsx from "clsx";

import { KEYS, queryFocusableElements } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import { CaliburnIslandComponent } from "./island.component";
import { CaliburnModalComponent } from "./modal.component";

import type { AfterViewInit, OnDestroy } from "@angular/core";

export type DialogSize = number | "small" | "regular" | "wide" | undefined;

const getDialogSize = (size: DialogSize): number => {
  if (size && typeof size === "number") {
    return size;
  }

  switch (size) {
    case "small":
      return 550;
    case "wide":
      return 1024;
    case "regular":
    default:
      return 800;
  }
};

let nextDialogId = 0;

/**
 * Angular port of upstream `Dialog.tsx`. Composes `caliburn-modal` +
 * `caliburn-island`; the Tab focus trap and initial autofocus are ported
 * from the `useEffect` on the island node. `aria-labelledby="dialog-title"`
 * on the modal is upstream's own literal string — it does not actually
 * match the title `<h2>`'s id (`${containerId}-dialog-title`), a pre-existing
 * upstream mismatch, ported as-is rather than "fixed". `setAppState({
 * openMenu: null })` from upstream's `onClose` is editor-state glue, not
 * part of this generic primitive — left for the consumer wiring
 * `(closeRequest)`. `class` routes onto the `.Modal` root — upstream puts
 * `className` there too (`Dialog.tsx`'s `<Modal className={clsx("Dialog",
 * props.className, ...)}>`), and `ConfirmDialog.tsx`/`HelpDialog.tsx` (Task
 * 19) depend on their own class landing on that element for
 * `ConfirmDialog.scss`/`HelpDialog.scss` to apply.
 */
@Component({
  selector: "caliburn-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnModalComponent, CaliburnIslandComponent, NgIcon],
  template: `
    <caliburn-modal
      [class]="modalClass()"
      [class.Dialog--fullscreen]="fullscreen()"
      [maxWidth]="dialogSize()"
      labelledBy="dialog-title"
      [closeOnClickOutside]="closeOnClickOutside()"
      (closeRequest)="onClose()"
    >
      <caliburn-island>
        @if (title()) {
          <h2 [id]="titleId" class="Dialog__title">
            <span class="Dialog__titleContent">{{ title() }}</span>
          </h2>
        }
        @if (fullscreen()) {
          <button
            class="Dialog__close"
            (click)="onClose()"
            [title]="closeLabel"
            [attr.aria-label]="closeLabel"
            type="button"
          >
            <ng-icon name="closeIcon" />
          </button>
        }
        <div class="Dialog__content"><ng-content /></div>
      </caliburn-island>
    </caliburn-modal>
  `,
})
export class CaliburnDialogComponent implements AfterViewInit, OnDestroy {
  private readonly id = `caliburn-dialog-${nextDialogId++}`;
  readonly titleId = `${this.id}-dialog-title`;
  readonly closeLabel = t("buttons.close");

  readonly title = input<string | false>(false);
  readonly size = input<DialogSize>();
  readonly autofocus = input(true);
  readonly closeOnClickOutside = input(true);
  /** whether the host formFactor is mobile — drives `.Dialog--fullscreen`
   * and the in-dialog close button, mirroring upstream's
   * `useEditorInterface().formFactor === "phone"`. */
  readonly fullscreen = input(false);
  readonly extraClass = input<string>("", { alias: "class" });

  readonly closeRequest = output<void>();

  readonly dialogSize = computed(() => getDialogSize(this.size()));
  readonly modalClass = computed(() => clsx("Dialog", this.extraClass()));

  private readonly island = viewChild(CaliburnIslandComponent, {
    read: ElementRef,
  });
  private readonly lastActiveElement =
    document.activeElement as HTMLElement | null;
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== KEYS.TAB) {
      return;
    }
    const islandNode = this.island()?.nativeElement as HTMLElement | undefined;
    if (!islandNode) {
      return;
    }
    const focusableElements = queryFocusableElements(islandNode);
    const { activeElement } = document;
    const currentIndex = focusableElements.findIndex(
      (element) => element === activeElement,
    );

    if (currentIndex === 0 && event.shiftKey) {
      focusableElements[focusableElements.length - 1].focus();
      event.preventDefault();
    } else if (
      currentIndex === focusableElements.length - 1 &&
      !event.shiftKey
    ) {
      focusableElements[0].focus();
      event.preventDefault();
    }
  };

  ngAfterViewInit() {
    const islandNode = this.island()?.nativeElement as HTMLElement | undefined;
    if (!islandNode) {
      return;
    }

    const focusableElements = queryFocusableElements(islandNode);
    setTimeout(() => {
      if (focusableElements.length > 0 && this.autofocus() !== false) {
        (focusableElements[1] || focusableElements[0]).focus();
      }
    });

    islandNode.addEventListener("keydown", this.handleKeyDown);
  }

  ngOnDestroy() {
    const islandNode = this.island()?.nativeElement as HTMLElement | undefined;
    islandNode?.removeEventListener("keydown", this.handleKeyDown);
  }

  onClose() {
    this.lastActiveElement?.focus?.();
    this.closeRequest.emit();
  }
}
