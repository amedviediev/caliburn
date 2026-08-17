import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

import { EVENT, KEYS } from "@excalidraw/common";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnIslandComponent } from "../island.component";
import { flipAtBoundary, shiftIntoBoundary } from "../popover-collision";

import type { CaliburnEditorComponent } from "../../editor.component";
import type { OnDestroy, OnInit } from "@angular/core";

/** upstream's Radix placement for this popover: `side="right"`,
 * `align="start"` — or `side="bottom"`, `align="center"` in mobile portrait —
 * with `sideOffset={20}` and `alignOffset={-16}` either way */
const SIDE_OFFSET = 20;
const ALIGN_OFFSET = -16;

/**
 * Angular port of upstream `PropertiesPopover.tsx` — the island the color
 * picker's popup body sits in. Radix's `Popover.Content` (portal, placement,
 * dismissal) is replaced by a `position: fixed` div measured off the trigger
 * plus explicit outside-pointerdown / Escape dismissal, the same substitution
 * `dropdown-menu-content.component.ts` makes; Radix's
 * `collisionBoundary={container}` becomes the shared flip/shift in
 * `popover-collision.ts`, run against the popover's own box once it renders.
 * Radix's decorative `Popover.Arrow` has no placement math to hang off and is
 * omitted.
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
    "[style.transform]": "transform()",
    "[style.marginLeft]": "marginLeft()",
  },
  imports: [CaliburnIslandComponent],
  templateUrl: "./properties-popover.component.html",
})
export class CaliburnPropertiesPopoverComponent implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly triggerRect = input.required<DOMRect | null>();

  readonly close = output<void>();

  /** upstream flips the popover under its trigger in mobile portrait, where
   * there is no room to its side */
  private readonly isMobilePortrait = computed(() => {
    const editorInterface = this.editor.editorInterface;
    return (
      editorInterface.formFactor === "phone" && !editorInterface.isLandscape
    );
  });

  private readonly popoverRect = signal<DOMRect | null>(null);
  private readonly boundaryRect = signal<DOMRect | null>(null);

  protected readonly top = computed(() => {
    const rect = this.triggerRect();
    if (!rect) {
      return 0;
    }
    const mobilePortrait = this.isMobilePortrait();
    const preferred = mobilePortrait
      ? rect.bottom + SIDE_OFFSET
      : rect.top + ALIGN_OFFSET;
    const boundary = this.boundaryRect();
    if (!boundary) {
      return preferred;
    }
    const height = this.popoverRect()?.height ?? 0;
    const bounds = { start: boundary.top, end: boundary.bottom };
    return mobilePortrait
      ? flipAtBoundary(
          preferred,
          rect.top - SIDE_OFFSET - height,
          height,
          bounds,
        )
      : shiftIntoBoundary(preferred, height, bounds);
  });

  protected readonly left = computed(() => {
    const rect = this.triggerRect();
    if (!rect) {
      return 0;
    }
    const mobilePortrait = this.isMobilePortrait();
    const preferred = mobilePortrait
      ? rect.left + rect.width / 2
      : rect.right + SIDE_OFFSET;
    const boundary = this.boundaryRect();
    if (!boundary) {
      return preferred;
    }
    const width = this.popoverRect()?.width ?? 0;
    const bounds = { start: boundary.left, end: boundary.right };
    // the mobile-portrait placement is a centre, not an edge, so it is the
    // shifted left edge that has to be turned back into one
    return mobilePortrait
      ? shiftIntoBoundary(preferred - width / 2, width, bounds) + width / 2
      : flipAtBoundary(
          preferred,
          rect.left - SIDE_OFFSET - width,
          width,
          bounds,
        );
  });

  /** the popover's own box is what the flip needs, so place it at the
   * preferred spot first and re-place it once it has rendered */
  private readonly placeAfterRender = effect(() => {
    this.triggerRect();
    afterNextRender(() => this.measure(), { injector: this.injector });
  });

  private measure() {
    const container = this.editor.containerRef()?.nativeElement;
    if (!container) {
      return;
    }
    this.popoverRect.set(this.host.nativeElement.getBoundingClientRect());
    this.boundaryRect.set(container.getBoundingClientRect());
  }

  protected readonly transform = computed(() =>
    this.isMobilePortrait() ? "translateX(-50%)" : null,
  );

  /** upstream's phone-only `marginLeft: "0.5rem"` */
  protected readonly marginLeft = computed(() =>
    this.editor.editorInterface.formFactor === "phone" ? "0.5rem" : null,
  );

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
