import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import clsx from "clsx";

import { CLASSES, EVENT, KEYS } from "@excalidraw/common";

import { CaliburnIslandComponent } from "../island.component";
import { CaliburnStackColComponent } from "../stack.component";

import { CaliburnDropdownMenuComponent } from "./dropdown-menu.component";

import type { ElementRef, OnDestroy, OnInit } from "@angular/core";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuContent.tsx`. Radix's
 * `DropdownMenu.Content` (positioning, `role="menu"`, focus management) is
 * replaced by a plain absolutely-positioned-by-CSS div with outside-click
 * and Escape handling (per the brief: "the panel components already use
 * plain absolutely positioned divs with outside-click handling; follow that
 * pattern") — only rendered while the parent `caliburn-dropdown-menu`'s
 * `open` is true, injected via DI (no `forwardRef`: no import cycle between
 * this file and `dropdown-menu.component.ts`). `mobile` replaces
 * `useEditorInterface().formFactor === "phone"`, see the trigger component.
 *
 * Positioning: `caliburn-dropdown-menu` (the shared wrapper) is `display:
 * contents`, so it can't itself be a `position: relative` containing block
 * for a CSS-only `position: absolute` pairing — instead this measures the
 * trigger's `getBoundingClientRect()` (via `menu.trigger()`) and applies
 * `position: fixed` with `top`/`right` computed from it, matching Radix's
 * actual rendered placement here (`side="bottom"`, `align="end"`,
 * `sideOffset={8}`).
 */
@Component({
  selector: "caliburn-dropdown-menu-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIslandComponent, CaliburnStackColComponent],
  template: `
    @if (menu.open()) {
      <div
        class="{{ hostClass() }}"
        data-testid="dropdown-menu"
        [style.position]="'fixed'"
        [style.top.px]="positionTop()"
        [style.right.px]="positionRight()"
        [style.left.px]="positionLeft()"
        #menuRoot
      >
        @if (mobile()) {
          <caliburn-stack-col class="dropdown-menu-container">
            <ng-content />
          </caliburn-stack-col>
        } @else {
          <caliburn-island class="dropdown-menu-container" [padding]="2">
            <ng-content />
          </caliburn-island>
        }
      </div>
    }
  `,
})
export class CaliburnDropdownMenuContentComponent implements OnInit, OnDestroy {
  readonly menu = inject(CaliburnDropdownMenuComponent);

  readonly mobile = input(false);
  /** upstream's Radix `align` prop; only the two alignments its call sites
   * use are honored — `end` (the default, right-aligned to the trigger) and
   * `start` (left-aligned, used by `MainMenu.tsx`) */
  readonly align = input<"start" | "end">("end");
  readonly extraClass = input<string>("", { alias: "class" });

  /** fires on outside click or Escape, mirroring upstream's `onClickOutside`. */
  readonly closeOutside = output<void>();
  /** fires when any descendant item is selected, mirroring upstream's `onSelect`. */
  readonly itemSelected = output<Event>();

  private readonly menuRoot = viewChild<ElementRef<HTMLElement>>("menuRoot");

  private readonly sideOffset = 8;
  private readonly triggerRect = signal<DOMRect | null>(null);

  readonly positionTop = computed(() => {
    const rect = this.triggerRect();
    return rect ? rect.bottom + this.sideOffset : 0;
  });
  readonly positionRight = computed(() => {
    const rect = this.triggerRect();
    return this.align() === "end" && rect
      ? Math.max(window.innerWidth - rect.right, 0)
      : null;
  });
  readonly positionLeft = computed(() => {
    const rect = this.triggerRect();
    return this.align() === "start" && rect ? Math.max(rect.left, 0) : null;
  });

  /** re-measures the trigger every time the menu actually opens (not just
   * once at construction): this component instance is created once by the
   * consumer and persists across open/close — only its `@if (menu.open())`
   * template block toggles — see `onDocKeydown`'s comment for the same
   * "instance outlives `open`" point. */
  private readonly measureTriggerOnOpen = effect(() => {
    if (!this.menu.open()) {
      return;
    }
    const triggerEl = this.menu.trigger()?.nativeElement as
      | HTMLElement
      | undefined;
    if (triggerEl) {
      this.triggerRect.set(triggerEl.getBoundingClientRect());
    }
  });

  readonly hostClass = computed(() =>
    clsx("dropdown-menu", this.extraClass(), {
      "dropdown-menu--mobile": this.mobile(),
    }),
  );

  private readonly onDocPointerDown = (event: Event) => {
    const menuNode = this.menuRoot()?.nativeElement;
    const target = event.target as Node | null;
    if (!menuNode || !target) {
      return;
    }
    if (
      menuNode.contains(target) ||
      !document.documentElement.contains(target)
    ) {
      return;
    }
    if ((target as Element).closest?.("[data-prevent-outside-click]")) {
      return;
    }
    if (
      !menuNode
        .closest(`.${CLASSES.DROPDOWN_MENU_EVENT_WRAPPER}`)
        ?.contains(target)
    ) {
      this.closeOutside.emit();
    }
  };

  private readonly onDocKeydown = (event: KeyboardEvent) => {
    // upstream only attaches this listener while `open` (DropdownMenuContent.tsx's
    // `useEffect` returns early when `!open`); this instance exists for as
    // long as *any* `caliburn-dropdown-menu` in the app is closed too (its
    // own `@if (menu.open())` only gates the rendered DOM, not the
    // component/its `ngOnInit`), so the guard has to be explicit here.
    if (!this.menu.open()) {
      return;
    }
    if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.closeOutside.emit();
    }
  };

  ngOnInit() {
    document.addEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown);
    document.addEventListener(EVENT.TOUCH_START, this.onDocPointerDown);
    document.addEventListener(EVENT.KEYDOWN, this.onDocKeydown, {
      capture: true,
    });
  }

  ngOnDestroy() {
    document.removeEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown);
    document.removeEventListener(EVENT.TOUCH_START, this.onDocPointerDown);
    document.removeEventListener(EVENT.KEYDOWN, this.onDocKeydown, {
      capture: true,
    });
  }
}
