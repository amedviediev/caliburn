import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

let nextSectionId = 0;

/**
 * Angular port of upstream `Section.tsx`. Renders a visually-hidden `<h2>`
 * heading labelling the `<section>` via `aria-labelledby`, matching
 * upstream's DOM contract. Upstream also accepts `children` as a render
 * function receiving the header node; no consumer uses that form (grepped
 * `packages/excalidraw/components/LayerUI.tsx`, the only caller), so only
 * the plain-children form is ported.
 */
@Component({
  selector: "caliburn-section",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class]="sectionClass()" [attr.aria-labelledby]="titleId()">
      <h2 class="visually-hidden" [id]="titleId()">{{ headingLabel() }}</h2>
      <ng-content />
    </section>
  `,
})
export class CaliburnSectionComponent {
  private readonly id = `caliburn-section-${nextSectionId++}`;

  readonly heading = input.required<
    "canvasActions" | "selectedShapeActions" | "shapes"
  >();
  readonly sectionClass = input<string>("", { alias: "class" });

  readonly titleId = computed(() => `${this.id}-${this.heading()}-title`);
  readonly headingLabel = computed(() =>
    t(`headings.${this.heading()}` as TranslationKeys),
  );
}
