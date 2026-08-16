import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

import clsx from "clsx";

import { EVENT, KEYS } from "@excalidraw/common";

import { NgIcon } from "@ng-icons/core";

import { CaliburnIslandComponent } from "../island.component";
import { CaliburnStackColComponent } from "../stack.component";

import { getDropdownMenuItemClassName } from "./common";
import { CaliburnDropdownMenuItemContentComponent } from "./dropdown-menu-item-content.component";

import type { OnDestroy, OnInit } from "@angular/core";

/** upstream `DropdownMenuSubContent.tsx` */
const BASE_ALIGN_OFFSET = -4;
const BASE_SIDE_OFFSET = 4;

/** grace period before a pointer that left the trigger closes the submenu —
 * stands in for Radix's own hover intent, so crossing the `BASE_SIDE_OFFSET`
 * gap between trigger and panel does not dismiss it mid-travel */
const CLOSE_GRACE_MS = 150;

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuSub.tsx` — the state
 * owner of a submenu. Radix's `DropdownMenu.Sub` (hover intent, roving focus,
 * ArrowRight/ArrowLeft navigation) is replaced the way the rest of caliburn's
 * dropdown primitives replace Radix: a plain open signal plus explicit
 * pointer/keyboard handlers. The trigger and the content are declared as this
 * component's children in the consumer's template, so they reach it through
 * the element injector even though they render through `<ng-content>`.
 *
 * Host-bound with `display: contents` (see `styles.scss`) so the trigger
 * `<button>` stays a direct flex child of `.dropdown-menu-container`, as
 * upstream's is.
 */
@Component({
  selector: "caliburn-dropdown-menu-sub",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./dropdown-menu-sub.component.html",
})
export class CaliburnDropdownMenuSubComponent implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly openSignal = signal(false);
  readonly open = this.openSignal.asReadonly();

  private triggerElement: HTMLElement | null = null;
  private closeTimeout = 0;

  registerTrigger(element: HTMLElement) {
    this.triggerElement = element;
  }

  triggerRect() {
    return this.triggerElement?.getBoundingClientRect() ?? null;
  }

  openSubmenu() {
    this.cancelClose();
    this.openSignal.set(true);
  }

  close() {
    this.cancelClose();
    this.openSignal.set(false);
  }

  scheduleClose() {
    this.cancelClose();
    this.closeTimeout = window.setTimeout(() => {
      this.openSignal.set(false);
    }, CLOSE_GRACE_MS);
  }

  cancelClose() {
    if (this.closeTimeout) {
      window.clearTimeout(this.closeTimeout);
      this.closeTimeout = 0;
    }
  }

  /** a pointerdown anywhere outside the submenu closes it — including one on
   * the enclosing menu's own trigger or on a sibling item, which is how this
   * submenu learns that the menu around it is going away (its host is
   * projected, so it cannot reach that menu through DI) */
  private readonly onDocPointerDown = (event: Event) => {
    if (!this.openSignal()) {
      return;
    }
    const target = event.target as Node | null;
    if (!target || !document.documentElement.contains(target)) {
      return;
    }
    if (!this.host.nativeElement.contains(target)) {
      this.close();
    }
  };

  /**
   * Escape closes the submenu only, leaving the menu around it open — Radix's
   * behavior. Bound on `window` in the capture phase so it always runs before
   * `caliburn-dropdown-menu-content`'s document-level handler (which would
   * otherwise close the whole menu), regardless of which registered first.
   */
  private readonly onWindowKeydown = (event: KeyboardEvent) => {
    if (!this.openSignal() || event.key !== KEYS.ESCAPE) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.close();
  };

  ngOnInit() {
    document.addEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown);
    document.addEventListener(EVENT.TOUCH_START, this.onDocPointerDown);
    window.addEventListener(EVENT.KEYDOWN, this.onWindowKeydown, {
      capture: true,
    });
  }

  ngOnDestroy() {
    this.cancelClose();
    document.removeEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown);
    document.removeEventListener(EVENT.TOUCH_START, this.onDocPointerDown);
    window.removeEventListener(EVENT.KEYDOWN, this.onWindowKeydown, {
      capture: true,
    });
  }
}

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuSubTrigger.tsx`. Radix
 * renders its `SubTrigger` as a `div[role="menuitem"]`; this is a `<button>`,
 * as every other caliburn dropdown item is, so it is focusable and
 * Enter/Space-activatable without a roving-tabindex implementation. The
 * classes, the `MenuItemContent` body and the trailing chevron are upstream's.
 */
@Component({
  selector: "button[caliburn-dropdown-menu-sub-trigger]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemContentComponent, NgIcon],
  host: {
    type: "button",
    "[class]": "hostClass()",
    "[attr.aria-haspopup]": "'menu'",
    "[attr.aria-expanded]": "sub.open()",
    "[attr.data-testid]": "testId() ?? null",
    "[attr.aria-label]": "ariaLabel() ?? null",
    "(click)": "onClick($event)",
    "(pointerenter)": "sub.openSubmenu()",
    "(pointerleave)": "sub.scheduleClose()",
  },
  templateUrl: "./dropdown-menu-sub-trigger.component.html",
})
export class CaliburnDropdownMenuSubTriggerComponent implements OnInit {
  protected readonly sub = inject(CaliburnDropdownMenuSubComponent);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly icon = input<string>();
  readonly shortcut = input<string>();
  readonly testId = input<string>();
  readonly ariaLabel = input<string>();
  readonly mobile = input(false);
  readonly extraClass = input<string>("", { alias: "class" });

  readonly hostClass = computed(
    () =>
      `${getDropdownMenuItemClassName(
        this.extraClass(),
      )} dropdown-menu__submenu-trigger`,
  );

  ngOnInit() {
    this.sub.registerTrigger(this.host.nativeElement);
  }

  /** Radix's `SubTrigger` opens on click and never closes on it — only the
   * pointer leaving, or Escape, closes a submenu. The `preventDefault` keeps
   * the click from reaching the enclosing menu's select handler, which would
   * close the whole menu. */
  protected onClick(event: Event) {
    event.preventDefault();
    this.sub.openSubmenu();
  }
}

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuSubContent.tsx`. Radix's
 * popper (`side="right"`, `align="start"`) is replaced by the same measured
 * `position: fixed` placement `caliburn-dropdown-menu-content` uses, carrying
 * upstream's own offsets and its flip-back-over-the-parent collision branch.
 * `mobile` replaces `useEditorInterface().formFactor === "phone"`, as in the
 * other dropdown primitives.
 */
@Component({
  selector: "caliburn-dropdown-menu-sub-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIslandComponent, CaliburnStackColComponent],
  templateUrl: "./dropdown-menu-sub-content.component.html",
})
export class CaliburnDropdownMenuSubContentComponent {
  protected readonly sub = inject(CaliburnDropdownMenuSubComponent);
  private readonly injector = inject(Injector);

  readonly mobile = input(false);
  readonly extraClass = input<string>("", { alias: "class" });

  private readonly panel = viewChild<ElementRef<HTMLElement>>("panel");

  private readonly sideOffset = signal(BASE_SIDE_OFFSET);
  private readonly alignOffset = signal(BASE_ALIGN_OFFSET);
  private readonly anchor = signal<{ right: number; top: number } | null>(null);

  readonly positionLeft = computed(() => {
    const anchor = this.anchor();
    return anchor ? anchor.right + this.sideOffset() : 0;
  });
  readonly positionTop = computed(() => {
    const anchor = this.anchor();
    return anchor ? anchor.top + this.alignOffset() : 0;
  });

  readonly hostClass = computed(() =>
    clsx("dropdown-menu", "dropdown-submenu", this.extraClass(), {
      "dropdown-menu--mobile": this.mobile(),
    }),
  );

  /** anchor off the trigger before the panel exists, then re-measure once it
   * does — its width is what upstream's collision branch needs */
  private readonly placeOnOpen = effect(() => {
    if (!this.sub.open()) {
      return;
    }
    this.sideOffset.set(BASE_SIDE_OFFSET);
    this.alignOffset.set(BASE_ALIGN_OFFSET);
    this.anchor.set(this.readAnchor());
    afterNextRender(() => this.avoidCollision(), { injector: this.injector });
  });

  private readAnchor() {
    const rect = this.sub.triggerRect();
    return rect ? { right: rect.right, top: rect.top } : null;
  }

  private avoidCollision() {
    const panel = this.panel()?.nativeElement;
    if (!panel) {
      return;
    }
    this.anchor.set(this.readAnchor());
    const parentRect = panel
      .closest(".dropdown-menu-container")
      ?.getBoundingClientRect();
    if (!parentRect) {
      return;
    }
    const menuWidth = panel.getBoundingClientRect().width;
    const spaceRemaining = window.innerWidth - parentRect.right;
    if (spaceRemaining < menuWidth + 20) {
      this.sideOffset.set(spaceRemaining - menuWidth + BASE_ALIGN_OFFSET);
      this.alignOffset.set(BASE_ALIGN_OFFSET + 8);
    }
  }
}
