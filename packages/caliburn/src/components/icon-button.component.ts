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
export type IconButtonMode = "button" | "icon" | "toggle";

/**
 * Angular port of upstream `IconButton.tsx` — the toolbar/tool-button
 * primitive (upstream's per-tool `*ToolButton` components in `Tools.tsx`
 * are thin wrappers around this; there is no standalone `ToolButton.tsx` at
 * the pinned commit). Covers all three upstream `type` variants: `button`/
 * `icon` (plain activation, optional async `onClick` → loading state) and
 * `toggle` (a stateful tool button, `aria-pressed`/`ToolIcon--checked`,
 * `onSelect` reporting the activating pointer type). Named `mode` here
 * (upstream's prop is called `type`) because the host is now the real
 * `<button>` element (see below) and `type` is already the native
 * button-type attribute (`"button"`/`"submit"`/`"reset"`) — this component
 * always sets that to `"button"` statically.
 *
 * Attribute-selector component (`button[caliburn-icon-button]`): the host
 * IS the real `<button>` — no wrapper tag — since `.ToolIcon`-family
 * elements are exactly the kind of thing upstream layout CSS targets with
 * `>`-combinators (e.g. `.App-menu_top__left > .ToolIcon__penMode`,
 * `LayerUI.scss`) once placed in a real toolbar (Task 17).
 */
@Component({
  selector: "button[caliburn-icon-button]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CaliburnSpinnerComponent],
  host: {
    type: "button",
    "[class]": "hostClass()",
    "[attr.title]": "title() ?? null",
    "[attr.aria-label]": "ariaLabel()",
    "[attr.aria-keyshortcuts]":
      "isToggle() ? (ariaKeyshortcuts() ?? null) : null",
    "[attr.aria-pressed]": "isToggle() ? checked() : null",
    "[attr.data-testid]": "testId() ?? null",
    "[hidden]": "hostHidden()",
    "[disabled]": "hostDisabled()",
    "[attr.aria-disabled]": "hostAriaDisabled()",
    "(pointerdown)": "onPointerDown($event)",
    "(pointerup)": "onPointerUp()",
    "(click)": "onHostClick($event)",
  },
  templateUrl: "./icon-button.component.html",
})
export class CaliburnIconButtonComponent {
  readonly mode = input.required<IconButtonMode>();
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

  /** `mode: "button" | "icon"` activation; may return a promise to drive
   * the loading state, mirroring upstream's `onClick` return-value check. */
  readonly onClick = input<(event: MouseEvent) => unknown>();
  /** `mode: "toggle"` activation. */
  readonly select = output<{ pointerType: PointerType | null }>();

  private readonly internalLoadingState = signal(false);
  readonly internalLoading = this.internalLoadingState.asReadonly();
  private isMounted = true;
  private lastPointerType: PointerType | null = null;

  readonly isToggle = computed(() => this.mode() === "toggle");

  readonly isDisabled = computed(
    () => this.internalLoadingState() || this.isLoading() || this.disabled(),
  );

  readonly hostHidden = computed(() => !this.isToggle() && this.hidden());
  readonly hostDisabled = computed(() =>
    this.isToggle() ? this.disabled() : this.isDisabled(),
  );
  readonly hostAriaDisabled = computed(() =>
    this.isToggle() ? this.disabled() : null,
  );

  private readonly sizeClass = computed(() => `ToolIcon_size_${this.size()}`);

  private readonly buttonClass = computed(() =>
    clsx(
      "ToolIcon_type_button",
      this.sizeClass(),
      this.visible() && !this.hidden()
        ? "ToolIcon_type_button--show"
        : "ToolIcon_type_button--hide",
      {
        ToolIcon: !this.hidden(),
        "ToolIcon--plain": this.mode() === "icon",
      },
    ),
  );

  private readonly toggleClass = computed(() =>
    clsx("ToolIcon", "ToolIcon_type_toggle", this.sizeClass(), {
      "ToolIcon--checked": this.checked(),
    }),
  );

  readonly hostClass = computed(() =>
    this.isToggle() ? this.toggleClass() : this.buttonClass(),
  );

  onHostClick(event: MouseEvent) {
    if (this.isToggle()) {
      this.onToggleClick();
    } else {
      this.onButtonClick(event);
    }
  }

  private async onButtonClick(event: MouseEvent) {
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

  private onToggleClick() {
    this.select.emit({ pointerType: this.lastPointerType });
  }

  ngOnDestroy() {
    this.isMounted = false;
  }
}
