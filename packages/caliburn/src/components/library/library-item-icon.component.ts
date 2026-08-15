import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
} from "@angular/core";

import type { LibraryItem } from "@excalidraw/excalidraw/types";

import { getLibraryItemSvg } from "./library-item-svg";

/**
 * Angular port of upstream `CommandPalette.tsx`'s `LibraryItemIcon` — the
 * library-item preview the palette renders in place of a command icon. The
 * host element IS upstream's `.library-item-icon` div.
 */
@Component({
  selector: "caliburn-library-item-icon",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "library-item-icon" },
  templateUrl: "./library-item-icon.component.html",
})
export class CaliburnLibraryItemIconComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly id = input.required<LibraryItem["id"] | null>();
  readonly elements = input<LibraryItem["elements"]>();

  private readonly renderSvg = effect((onCleanup) => {
    const id = this.id();
    const elements = this.elements();
    const node = this.host.nativeElement;

    let disposed = false;
    onCleanup(() => {
      disposed = true;
      node.innerHTML = "";
    });

    getLibraryItemSvg(id, elements).then((svg) => {
      if (!disposed && svg) {
        node.innerHTML = svg.outerHTML;
      }
    });
  });
}
