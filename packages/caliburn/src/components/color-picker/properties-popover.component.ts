import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from "@angular/core";

import { EVENT, KEYS } from "@excalidraw/common";

import { CaliburnIslandComponent } from "../island.component";

import type { OnDestroy, OnInit } from "@angular/core";

/** upstream's Radix placement for this popover: `side="right"`,
 * `sideOffset={20}`, `align="start"`, `alignOffset={-16}` */
const SIDE_OFFSET = 20;
const ALIGN_OFFSET = -16;

/**
 * Angular port of upstream `PropertiesPopover.tsx` — the island the color
 * picker's popup body sits in. Radix's `Popover.Content` (portal, placement,
 * dismissal) is replaced by a `position: fixed` div measured off the trigger
 * plus explicit outside-pointerdown / Escape dismissal, the same substitution
 * `dropdown-menu-content.component.ts` makes. Radix's decorative
 * `Popover.Arrow` has no placement math to hang off and is omitted.
 *
 * Attribute-selector component: the host IS the popover element, so
 * `[data-prevent-outside-click]` sits where the dropdown menu looks for it
 * (the picker opens inside the main menu for the canvas background).
 */
@Component({
  selector: "div[caliburn-properties-popover]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "focus-visible-none",
    "data-prevent-outside-click": "",
    style: "position: fixed; z-index: var(--zIndex-ui-styles-popup)",
    "[style.top.px]": "top()",
    "[style.left.px]": "left()",
  },
  imports: [CaliburnIslandComponent],
  templateUrl: "./properties-popover.component.html",
})
export class CaliburnPropertiesPopoverComponent implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly triggerRect = input.required<DOMRect | null>();

  readonly close = output<void>();

  protected readonly top = computed(() => {
    const rect = this.triggerRect();
    return rect ? rect.top + ALIGN_OFFSET : 0;
  });

  protected readonly left = computed(() => {
    const rect = this.triggerRect();
    return rect ? rect.right + SIDE_OFFSET : 0;
  });

  private readonly onDocPointerDown = (event: Event) => {
    const target = event.target as Node | null;
    if (!target || !document.documentElement.contains(target)) {
      return;
    }
    if (this.host.nativeElement.contains(target)) {
      return;
    }
    // a color-picker trigger toggles/switches the popup on click — dismissing
    // on its pointerdown would reopen this one right after
    if ((target as Element).closest?.("[data-openpopup]")) {
      return;
    }
    this.close.emit();
  };

  private readonly onDocKeydown = (event: KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE) {
      this.close.emit();
    }
  };

  ngOnInit() {
    document.addEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown);
    document.addEventListener(EVENT.KEYDOWN, this.onDocKeydown, {
      capture: true,
    });
  }

  ngOnDestroy() {
    document.removeEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown);
    document.removeEventListener(EVENT.KEYDOWN, this.onDocKeydown, {
      capture: true,
    });
  }
}
