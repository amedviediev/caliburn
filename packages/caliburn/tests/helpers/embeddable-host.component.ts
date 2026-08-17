import {
  ChangeDetectionStrategy,
  Component,
  input,
  viewChild,
} from "@angular/core";

import type {
  ExcalidrawEmbeddableElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent } from "../../src/editor.component";

import type { TemplateRef } from "@angular/core";

import type { CaliburnEmbeddableContext } from "../../src/components/embeddable.component";

/**
 * Host app for the `renderEmbeddable` tests: upstream's prop is a render
 * function returning a node or `null`, so the host here returns its own
 * template for the ids it claims and `null` for every other embeddable —
 * which is what makes the per-element fallback to the default `<iframe>`
 * assertable.
 *
 * Lives in a `.ts` module rather than in the `.tsx` test file because only
 * `.ts` goes through the Angular compiler in this project.
 */
@Component({
  selector: "caliburn-test-embeddable-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEditorComponent],
  templateUrl: "./embeddable-host.component.html",
})
export class CaliburnEmbeddableHostComponent {
  /** the embeddables this host renders itself; the rest fall back */
  readonly hostRenderedIds = input<readonly string[]>([]);

  private readonly hostEmbed =
    viewChild<TemplateRef<CaliburnEmbeddableContext>>("hostEmbed");

  /** the last arguments the editor called `renderEmbeddable` with */
  lastCall: {
    element: NonDeleted<ExcalidrawEmbeddableElement>;
    appState: AppState;
  } | null = null;

  readonly renderEmbeddable = (
    element: NonDeleted<ExcalidrawEmbeddableElement>,
    appState: AppState,
  ): TemplateRef<CaliburnEmbeddableContext> | null => {
    this.lastCall = { element, appState };
    return this.hostRenderedIds().includes(element.id)
      ? this.hostEmbed() ?? null
      : null;
  };
}
