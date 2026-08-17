import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import { NgIcon } from "@ng-icons/core";

/**
 * Angular port of upstream `excalidraw-app/components/DebugCanvas.tsx`'s
 * `DebugFooter` — the frame stepper the visual debugger puts in the footer.
 *
 * Upstream's `onChange` prop becomes the `refresh` output, wired by the host
 * to the same repaint the main menu's toggle asks for: upstream calls
 * `excalidrawAPI.refresh()`, which only matters because it re-renders the app
 * and so re-runs `debugRenderer`; caliburn's imperative API has no `refresh`,
 * so the host repaints the debug canvas directly.
 *
 * The first three buttons carry `data-testid="debug-forward"` and
 * `aria-label="Move forward"` verbatim, as upstream's own copy-paste left
 * them, so the DOM matches the oracle.
 */
@Component({
  selector: "caliburn-debug-footer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./debug-footer.component.html",
})
export class CaliburnDebugFooterComponent {
  readonly refresh = output<void>();

  protected moveForward() {
    if (
      !window.visualDebug?.currentFrame ||
      isNaN(window.visualDebug?.currentFrame ?? -1)
    ) {
      window.visualDebug!.currentFrame = 0;
    }
    window.visualDebug!.currentFrame += 1;
    this.refresh.emit();
  }

  protected moveBackward() {
    if (
      !window.visualDebug?.currentFrame ||
      isNaN(window.visualDebug?.currentFrame ?? -1) ||
      window.visualDebug?.currentFrame < 1
    ) {
      window.visualDebug!.currentFrame = 1;
    }
    window.visualDebug!.currentFrame -= 1;
    this.refresh.emit();
  }

  protected reset() {
    window.visualDebug!.currentFrame = undefined;
    this.refresh.emit();
  }

  protected trashFrames() {
    if (window.visualDebug) {
      window.visualDebug.currentFrame = undefined;
      window.visualDebug.data = [];
    }
    this.refresh.emit();
  }
}
