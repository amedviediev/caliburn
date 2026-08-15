import {
  ChangeDetectionStrategy,
  Component,
  effect,
  signal,
} from "@angular/core";

import { NgIcon } from "@ng-icons/core";

import { CaliburnTooltipComponent } from "../../../packages/caliburn/src/index";
import { collabErrorIndicator } from "../app-state";

import type { OnDestroy } from "@angular/core";

/**
 * Angular port of upstream `excalidraw-app/collab/CollabError.tsx`. The
 * shake animation restarts on every new error (upstream reruns its effect on
 * the indicator's `nonce`).
 */
@Component({
  selector: "caliburn-app-collab-error",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnTooltipComponent, NgIcon],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./collab-error.component.html",
})
export class CaliburnAppCollabErrorComponent implements OnDestroy {
  protected readonly collabError = collabErrorIndicator;
  protected readonly isAnimating = signal(false);

  private clearAnimationTimeout = 0;

  private readonly restartAnimation = effect(() => {
    // reruns on both, as upstream's effect deps do
    const { message, nonce } = this.collabError();
    if (!message && !nonce) {
      return;
    }

    this.isAnimating.set(true);
    window.clearTimeout(this.clearAnimationTimeout);
    this.clearAnimationTimeout = window.setTimeout(() => {
      this.isAnimating.set(false);
    }, 1000);
  });

  ngOnDestroy() {
    window.clearTimeout(this.clearAnimationTimeout);
  }
}
