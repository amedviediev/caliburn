import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { NgIcon } from "@ng-icons/core";

import type { LibraryItem } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnCheckboxItemComponent } from "../checkbox-item.component";

import { getLibraryItemSvg } from "./library-item-svg";

import type { ElementRef } from "@angular/core";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `LibraryUnit.tsx`. The host element IS upstream's
 * `.library-unit` div — it is a direct grid item of
 * `.library-menu-items-container__grid`.
 *
 * Upstream's `useLibraryItemSvg` hook (preview export + cache + `innerHTML`
 * write on the dragger node) is the `renderSvg` effect below; see
 * `library-item-svg.ts`.
 */
@Component({
  selector: "caliburn-library-unit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnCheckboxItemComponent, NgIcon],
  host: {
    class: "library-unit",
    "[class.library-unit__active]": "!!elements()",
    "[class.library-unit--hover]": "!!elements() && isHovered()",
    "[class.library-unit--selected]": "selected()",
    "[class.library-unit--skeleton]": "!svg()",
    "(mouseenter)": "isHovered.set(true)",
    "(mouseleave)": "isHovered.set(false)",
  },
  templateUrl: "./library-unit.component.html",
})
export class CaliburnLibraryUnitComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly id = input.required<LibraryItem["id"] | null>();
  readonly elements = input<LibraryItem["elements"]>();
  readonly isPending = input(false);
  readonly selected = input.required<boolean>();

  readonly itemClick = output<LibraryItem["id"] | null>();
  readonly itemToggle = output<{ id: string; event: MouseEvent }>();
  readonly itemDrag = output<{ id: string; event: DragEvent }>();

  protected readonly isHovered = signal(false);
  protected readonly svg = signal<SVGSVGElement | undefined>(undefined);
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected readonly showCheckbox = computed(
    () =>
      !!this.id() &&
      !!this.elements() &&
      (this.isHovered() || this.isMobile || this.selected()),
  );

  private readonly dragger =
    viewChild.required<ElementRef<HTMLDivElement>>("dragger");

  private readonly renderSvg = effect((onCleanup) => {
    const id = this.id();
    const elements = this.elements();
    const node = this.dragger().nativeElement;

    let disposed = false;
    onCleanup(() => {
      disposed = true;
      node.innerHTML = "";
    });

    getLibraryItemSvg(id, elements).then((svg) => {
      if (disposed || !svg) {
        return;
      }
      this.svg.set(svg);
      node.innerHTML = svg.outerHTML;
    });
  });

  protected onDraggerClick(event: MouseEvent) {
    if (!this.elements() && !this.isPending()) {
      return;
    }
    const id = this.id();
    if (id && event.shiftKey) {
      this.itemToggle.emit({ id, event });
    } else {
      this.itemClick.emit(id);
    }
  }

  protected onDragStart(event: DragEvent) {
    const id = this.id();
    if (!id) {
      event.preventDefault();
      return;
    }
    this.isHovered.set(false);
    this.itemDrag.emit({ id, event });
  }
}

/**
 * Angular port of upstream `LibraryUnit.tsx`'s `EmptyLibraryUnit`.
 */
@Component({
  selector: "caliburn-empty-library-unit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "library-unit library-unit--skeleton" },
  templateUrl: "./empty-library-unit.component.html",
})
export class CaliburnEmptyLibraryUnitComponent {}
