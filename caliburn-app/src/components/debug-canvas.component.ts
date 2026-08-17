import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from "@angular/core";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { ElementRef } from "@angular/core";

/**
 * Angular port of upstream `excalidraw-app/components/DebugCanvas.tsx`'s
 * default export — the transparent overlay the visual debugger paints its
 * primitives onto, sized in CSS pixels from `appState` and backed at the
 * device pixel ratio the host passes as `scale`.
 *
 * Upstream forwards a ref to the `<canvas>` so the app can hand it to
 * `debugRenderer`; here the element is read off `canvasElement` instead,
 * which is `null` until the view has been created (upstream's ref is `null`
 * on the first render for the same reason).
 */
@Component({
  selector: "caliburn-debug-canvas",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: "display: contents;",
  },
  templateUrl: "./debug-canvas.component.html",
})
export class CaliburnDebugCanvasComponent {
  readonly appState = input.required<AppState>();
  readonly scale = input.required<number>();

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("canvas");

  readonly canvasElement = computed(
    () => this.canvasRef()?.nativeElement ?? null,
  );
}
