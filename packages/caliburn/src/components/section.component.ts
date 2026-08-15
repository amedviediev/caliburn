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
 *
 * Attribute-selector component (`section[caliburn-section]`): the host IS
 * the real `<section>` — no wrapper tag. A custom-element wrapper would
 * both introduce an intervening node for any future `>`-keyed selector and
 * lose `<section>`'s implicit ARIA landmark ("region") role, which only
 * applies to the real element.
 */
@Component({
  selector: "section[caliburn-section]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[attr.aria-labelledby]": "titleId()",
  },
  templateUrl: "./section.component.html",
})
export class CaliburnSectionComponent {
  private readonly id = `caliburn-section-${nextSectionId++}`;

  readonly heading = input.required<
    "canvasActions" | "selectedShapeActions" | "shapes"
  >();

  readonly titleId = computed(() => `${this.id}-${this.heading()}-title`);
  readonly headingLabel = computed(() =>
    t(`headings.${this.heading()}` as TranslationKeys),
  );
}
