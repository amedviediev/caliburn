import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import {
  isElementInViewport,
  isEmbeddableElement,
  isIframeElement,
} from "@excalidraw/element";

import type {
  ExcalidrawIframeLikeElement,
  NonDeleted,
  Ordered,
} from "@excalidraw/element/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnEmbeddableComponent } from "./embeddable.component";

import type { CaliburnEditorComponent } from "../editor.component";

/** one entry of upstream `renderEmbeddables`' map, after its visibility pass */
export type RenderedEmbeddable = {
  element: Ordered<NonDeleted<ExcalidrawIframeLikeElement>>;
  isVisible: boolean;
};

/**
 * Angular port of upstream `App.tsx`'s `renderEmbeddables`: the DOM overlay
 * of `<iframe>`s laid over the canvas, one per embeddable whose link the
 * editor validated (`embedsValidationStatus`) and per `iframe` element.
 *
 * The filter and its viewport-visibility bookkeeping live here; everything
 * upstream renders per element — the container, its inner box, the hover
 * hint and the `<iframe>` itself — lives in `caliburn-embeddable`, which
 * also registers its iframe into `App.iFrameRefs` (upstream does that from
 * the `<iframe>`'s React `ref` callback).
 */
@Component({
  selector: "caliburn-embeddables",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEmbeddableComponent],
  templateUrl: "./embeddables.component.html",
})
export class CaliburnEmbeddablesComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected embeddables(): readonly RenderedEmbeddable[] {
    this.host.changeGeneration();
    const state = this.host.state;
    const normalizedWidth = state.width;
    const normalizedHeight = state.height;
    const elementsMap = this.host.scene.getNonDeletedElementsMap();

    const embeddableElements = this.host.scene
      .getNonDeletedElements()
      .filter(
        (el): el is Ordered<NonDeleted<ExcalidrawIframeLikeElement>> =>
          (isEmbeddableElement(el) &&
            this.host.embedsValidationStatus.get(el.id) === true) ||
          isIframeElement(el),
      );

    const rendered: RenderedEmbeddable[] = [];

    for (const element of embeddableElements) {
      const isVisible = isElementInViewport(
        element,
        normalizedWidth,
        normalizedHeight,
        state,
        elementsMap,
      );
      const hasBeenInitialized = this.host.initializedEmbeds.has(element.id);

      if (isVisible && !hasBeenInitialized) {
        this.host.initializedEmbeds.add(element.id);
      }
      const shouldRender = isVisible || hasBeenInitialized;

      if (!shouldRender) {
        continue;
      }

      rendered.push({ element, isVisible });
    }

    return rendered;
  }
}
