import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
} from "@angular/core";

import { CaliburnIconButtonComponent } from "./icon-button.component";

import type { OnDestroy } from "@angular/core";

export const DEFAULT_TOAST_TIMEOUT = 5000;

/**
 * Angular port of upstream `Toast.tsx`. Host-bound: the host element IS
 * upstream's `.Toast` div. Upstream's `Toast.ProgressBar` static has no
 * caliburn consumer (its call sites are unported surfaces) and is not ported;
 * neither is the `style` prop, which upstream only passes from those.
 */
@Component({
  selector: "caliburn-toast",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  host: {
    class: "Toast",
    role: "status",
    "(mouseenter)": "onMouseEnter()",
    "(mouseleave)": "onMouseLeave()",
  },
  template: `
    <div class="Toast__message">{{ message() }}</div>
    @if (closable()) {
    <button
      caliburn-icon-button
      class="close"
      mode="icon"
      icon="closeIcon"
      ariaLabel="close"
      [onClick]="onCloseClick"
    ></button>
    }
  `,
})
export class CaliburnToastComponent implements OnDestroy {
  readonly message = input.required<string>();
  readonly closable = input(false);
  /** pass `Infinity` to prevent autoclose, as upstream does */
  readonly duration = input(DEFAULT_TOAST_TIMEOUT);

  readonly close = output<void>();

  private timer = 0;

  protected readonly onCloseClick = () => this.close.emit();

  constructor() {
    effect(() => {
      // upstream reschedules on every message/duration change
      this.message();
      this.duration();
      this.scheduleTimeout();
    });
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  protected onMouseEnter() {
    if (this.shouldAutoClose()) {
      clearTimeout(this.timer);
    }
  }

  protected onMouseLeave() {
    if (this.shouldAutoClose()) {
      this.scheduleTimeout();
    }
  }

  private shouldAutoClose() {
    return this.duration() !== Infinity;
  }

  private scheduleTimeout() {
    clearTimeout(this.timer);
    if (!this.shouldAutoClose()) {
      return;
    }
    this.timer = window.setTimeout(() => this.close.emit(), this.duration());
  }
}
