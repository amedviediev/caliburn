import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from "@angular/core";

import clsx from "clsx";

import { isPromiseLike } from "@excalidraw/common";

import { AbortError } from "@excalidraw/excalidraw/errors";

import { NgIcon } from "@ng-icons/core";

import { CaliburnSpinnerComponent } from "./spinner.component";

export type FilledButtonVariant = "filled" | "outlined" | "icon";
export type FilledButtonColor =
  | "primary"
  | "danger"
  | "warning"
  | "muted"
  | "success";
export type FilledButtonSize = "medium" | "large";
export type FilledButtonStatus = null | "loading" | "success";

/**
 * Angular port of upstream `FilledButton.tsx` (`.ExcButton`). `onClick` may
 * return a promise, which drives the (delayed) loading spinner state exactly
 * like upstream's internal `isLoading`.
 */
@Component({
  selector: "caliburn-filled-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CaliburnSpinnerComponent],
  template: `
    <button
      type="button"
      [class]="hostClass()"
      [attr.aria-label]="label() ?? null"
      [disabled]="isDisabled()"
      (click)="handleClick($event)"
    >
      <div class="ExcButton__contents">
        @if (effectiveStatus() === "loading") {
          <caliburn-spinner class="ExcButton__statusIcon" />
        } @else if (effectiveStatus() === "success") {
          <div class="ExcButton__statusIcon">
            <ng-icon name="tablerCheckIcon" />
          </div>
        }
        @if (icon()) {
          <div class="ExcButton__icon" aria-hidden="true">
            <ng-icon [name]="icon()!" />
          </div>
        }
        @if (variant() !== "icon") {
          <ng-content>{{ label() }}</ng-content>
        }
      </div>
    </button>
  `,
})
export class CaliburnFilledButtonComponent {
  readonly label = input<string>();
  readonly onClick = input<(event: MouseEvent) => unknown>();
  readonly status = input<FilledButtonStatus>(null);
  readonly variant = input<FilledButtonVariant>("filled");
  readonly color = input<FilledButtonColor>("primary");
  readonly size = input<FilledButtonSize>("medium");
  readonly extraClass = input<string>("", { alias: "class" });
  readonly fullWidth = input(false);
  readonly icon = input<string>();
  readonly disabled = input(false);

  private readonly internalLoadingState = signal(false);

  readonly effectiveStatus = computed<FilledButtonStatus>(() =>
    this.internalLoadingState() ? "loading" : this.status(),
  );
  private readonly effectiveColor = computed(() =>
    this.effectiveStatus() === "success" ? "success" : this.color(),
  );
  readonly isDisabled = computed(
    () =>
      this.disabled() ||
      this.effectiveStatus() === "loading" ||
      this.effectiveStatus() === "success",
  );

  readonly hostClass = computed(() =>
    clsx(
      "ExcButton",
      `ExcButton--color-${this.effectiveColor()}`,
      `ExcButton--variant-${this.variant()}`,
      `ExcButton--size-${this.size()}`,
      `ExcButton--status-${this.effectiveStatus()}`,
      { "ExcButton--fullWidth": this.fullWidth() },
      this.extraClass(),
    ),
  );

  async handleClick(event: MouseEvent) {
    const ret = this.onClick()?.(event);

    if (isPromiseLike(ret)) {
      // delay loading state to prevent flicker in case of quick response
      const timer = window.setTimeout(() => {
        this.internalLoadingState.set(true);
      }, 50);
      try {
        await ret;
      } catch (error: any) {
        if (!(error instanceof AbortError)) {
          throw error;
        } else {
          console.warn(error);
        }
      } finally {
        window.clearTimeout(timer);
        this.internalLoadingState.set(false);
      }
    }
  }
}
