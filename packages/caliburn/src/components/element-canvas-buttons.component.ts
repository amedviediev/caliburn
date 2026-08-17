import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getElementAbsoluteCoords } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import type { CaliburnEditorComponent } from "../editor.component";

const CONTAINER_PADDING = 5;

/**
 * Angular port of upstream `ElementCanvasButtons.tsx` — the floating column
 * of buttons an element carries just outside its right edge. Attribute-
 * selector component (`div[caliburn-element-canvas-buttons]`): the host IS
 * the `.excalidraw-canvas-buttons` div, so the vendored SCSS lays its
 * projected buttons out unchanged.
 *
 * Upstream renders nothing at all while a menu, a context menu or an
 * in-flight gesture is up; `hidden()` is that predicate, read by the caller
 * (Angular has no "render null from inside" for a host element).
 */
@Component({
  selector: "div[caliburn-element-canvas-buttons]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "excalidraw-canvas-buttons",
    "[style.top]": "top()",
    "[style.left]": "left()",
    "[style.padding.px]": "padding",
  },
  templateUrl: "./element-canvas-buttons.component.html",
})
export class CaliburnElementCanvasButtonsComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly element = input.required<NonDeletedExcalidrawElement>();

  protected readonly padding = CONTAINER_PADDING;

  private readonly coords = computed(() => {
    this.host.changeGeneration();
    const appState = this.host.state;
    const [x1, y1] = getElementAbsoluteCoords(
      this.element(),
      this.host.scene.getNonDeletedElementsMap(),
    );
    const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
      { sceneX: x1 + this.element().width, sceneY: y1 },
      appState,
    );
    const x = viewportX - appState.offsetLeft + 10;
    const y = viewportY - appState.offsetTop;
    return { x, y };
  });

  protected readonly top = computed(() => `${this.coords().y}px`);
  protected readonly left = computed(() => `${this.coords().x}px`);
}

/** upstream `ElementCanvasButtons`' own early return */
export const areElementCanvasButtonsHidden = (
  editor: CaliburnEditorComponent,
) => {
  const appState = editor.state;
  return !!(
    appState.contextMenu ||
    appState.newElement ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.openMenu ||
    appState.viewModeEnabled
  );
};
