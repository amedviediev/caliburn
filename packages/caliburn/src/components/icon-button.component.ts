import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from "@angular/core";

import clsx from "clsx";

import { isPromiseLike } from "@excalidraw/common";

import { AbortError } from "@excalidraw/excalidraw/errors";

import { NgIcon } from "@ng-icons/core";

import type { PointerType } from "@excalidraw/element/types";

import { CaliburnSpinnerComponent } from "./spinner.component";

export type IconButtonSize = "small" | "medium";
export type IconButtonType = "button" | "icon" | "toggle";

/**
 * Angular port of upstream `IconButton.tsx` — the toolbar/tool-button
 * primitive (upstream's per-tool `*ToolButton` components in `Tools.tsx`
 * are thin wrappers around this; there is no standalone `ToolButton.tsx` at
 * the pinned commit). Covers all three upstream `type` variants: `button`/
 * `icon` (plain activation, optional async `onClick` → loading state) and
 * `toggle` (a stateful tool button, `aria-pressed`/`ToolIcon--checked`,
 * `onSelect` reporting the activating pointer type).
 */
@Component({
  selector: "caliburn-icon-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CaliburnSpinnerComponent],
  template: `
    @if (type() === "toggle") {
      <button
        type="button"
        [class]="toggleClass()"
        [attr.title]="title() ?? null"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-keyshortcuts]="ariaKeyshortcuts() ?? null"
        [attr.aria-pressed]="checked()"
        [attr.data-testid]="testId() ?? null"
        [disabled]="disabled()"
        [attr.aria-disabled]="disabled()"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp()"
        (click)="onToggleClick()"
      >
        <div class="ToolIcon__icon">
          @if (icon()) {
            <ng-icon [name]="icon()!" />
          }
          @if (keyBindingLabel()) {
            <span class="ToolIcon__keybinding">{{ keyBindingLabel() }}</span>
          }
        </div>
      </button>
    } @else {
      <button
        type="button"
        [class]="buttonClass()"
        [attr.data-testid]="testId() ?? null"
        [hidden]="hidden()"
        [attr.title]="title() ?? null"
        [attr.aria-label]="ariaLabel()"
        (click)="onButtonClick($event)"
        [disabled]="isDisabled()"
      >
        @if (icon() || labelText()) {
          <div
            class="ToolIcon__icon"
            aria-hidden="true"
            [attr.aria-disabled]="disabled()"
          >
            @if (icon()) {
              <ng-icon [name]="icon()!" />
            } @else {
              {{ labelText() }}
            }
            @if (keyBindingLabel()) {
              <span class="ToolIcon__keybinding">{{ keyBindingLabel() }}</span>
            }
            @if (isLoading()) {
              <caliburn-spinner />
            }
          </div>
        }
        @if (showAriaLabel()) {
          <div class="ToolIcon__label">
            {{ ariaLabel() }}
            @if (internalLoading()) {
              <caliburn-spinner />
            }
          </div>
        }
        <ng-content />
      </button>
    }
  `,
})
export class CaliburnIconButtonComponent {
  readonly type = input.required<IconButtonType>();
  readonly icon = input<string>();
  readonly labelText = input<string>();
  readonly ariaLabel = input.required<string>();
  readonly ariaKeyshortcuts = input<string>();
  readonly testId = input<string>();
  readonly title = input<string>();
  readonly size = input<IconButtonSize>("medium");
  readonly keyBindingLabel = input<string | null>();
  readonly showAriaLabel = input(false);
  readonly hidden = input(false);
  readonly visible = input(true);
  readonly disabled = input(false);
  readonly isLoading = input(false);
  readonly checked = input(false);
  readonly extraClass = input<string>("", { alias: "class" });

  /** `type: "button" | "icon"` activation; may return a promise to drive
   * the loading state, mirroring upstream's `onClick` return-value check. */
  readonly onClick = input<(event: MouseEvent) => unknown>();
  /** `type: "toggle"` activation. */
  readonly select = output<{ pointerType: PointerType | null }>();

  private readonly internalLoadingState = signal(false);
  readonly internalLoading = this.internalLoadingState.asReadonly();
  private isMounted = true;
  private lastPointerType: PointerType | null = null;

  readonly isDisabled = computed(
    () => this.internalLoadingState() || this.isLoading() || this.disabled(),
  );

  private readonly sizeClass = computed(() => `ToolIcon_size_${this.size()}`);

  readonly buttonClass = computed(() =>
    clsx(
      "ToolIcon_type_button",
      this.sizeClass(),
      this.extraClass(),
      this.visible() && !this.hidden()
        ? "ToolIcon_type_button--show"
        : "ToolIcon_type_button--hide",
      {
        ToolIcon: !this.hidden(),
        "ToolIcon--plain": this.type() === "icon",
      },
    ),
  );

  readonly toggleClass = computed(() =>
    clsx(
      "ToolIcon",
      "ToolIcon_type_toggle",
      this.sizeClass(),
      this.extraClass(),
      {
        "ToolIcon--checked": this.checked(),
      },
    ),
  );

  async onButtonClick(event: MouseEvent) {
    const ret = this.onClick()?.(event);

    if (isPromiseLike(ret)) {
      try {
        this.internalLoadingState.set(true);
        await ret;
      } catch (error: any) {
        if (!(error instanceof AbortError)) {
          throw error;
        } else {
          console.warn(error);
        }
      } finally {
        if (this.isMounted) {
          this.internalLoadingState.set(false);
        }
      }
    }
  }

  onPointerDown(event: PointerEvent) {
    this.lastPointerType = (event.pointerType as PointerType) || null;
  }

  onPointerUp() {
    requestAnimationFrame(() => {
      this.lastPointerType = null;
    });
  }

  onToggleClick() {
    this.select.emit({ pointerType: this.lastPointerType });
  }

  ngOnDestroy() {
    this.isMounted = false;
  }
}
