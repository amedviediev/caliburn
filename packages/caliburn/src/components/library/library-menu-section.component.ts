import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";

import type { ExcalidrawElement, NonDeleted } from "@excalidraw/element/types";

import type { LibraryItem } from "@excalidraw/excalidraw/types";

import {
  CaliburnEmptyLibraryUnitComponent,
  CaliburnLibraryUnitComponent,
} from "./library-unit.component";

export type LibraryOrPendingItem = readonly (
  | LibraryItem
  | /* pending library item */ {
      id: null;
      elements: readonly NonDeleted<ExcalidrawElement>[];
    }
)[];

/**
 * Angular port of upstream `LibraryMenuSection.tsx`'s `LibraryMenuSection`.
 *
 * Upstream renders a fragment; this host is `display: contents` (see
 * `styles.scss`) so the units stay direct grid items of
 * `.library-menu-items-container__grid`.
 *
 * Upstream's `useTransition`-driven batching is the `revealNextBatch` effect —
 * items past `index` render as skeletons until the next pass, keeping the
 * irregular fill-in pattern.
 */
@Component({
  selector: "caliburn-library-menu-section",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEmptyLibraryUnitComponent, CaliburnLibraryUnitComponent],
  templateUrl: "./library-menu-section.component.html",
})
export class CaliburnLibraryMenuSectionComponent {
  readonly items = input.required<LibraryOrPendingItem>();
  readonly itemsRenderedPerBatch = input.required<number>();
  readonly isItemSelected =
    input.required<(id: LibraryItem["id"] | null) => boolean>();

  readonly itemClick = output<LibraryItem["id"] | null>();
  readonly itemSelectToggle = output<{ id: string; event: MouseEvent }>();
  readonly itemDrag = output<{ id: string; event: DragEvent }>();

  protected readonly index = signal(0);

  private readonly revealNextBatch = effect(() => {
    const length = this.items().length;
    const batch = this.itemsRenderedPerBatch();
    // `index` stays in the effect's dependency set (upstream lists it in its
    // `useEffect` deps) so each batch schedules the next one; the write is
    // untracked only to keep it out of that read pass. Settles once
    // `index >= length`.
    const index = this.index();
    if (index < length) {
      untracked(() => this.index.set(index + batch));
    }
  });
}
