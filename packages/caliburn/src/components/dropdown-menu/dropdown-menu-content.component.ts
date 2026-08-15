import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";

import clsx from "clsx";

import { CLASSES, EVENT, KEYS } from "@excalidraw/common";

import { CaliburnIslandComponent } from "../island.component";
import { CaliburnStackColComponent } from "../stack.component";

import { CaliburnDropdownMenuComponent } from "./dropdown-menu.component";

import type { OnDestroy, OnInit, ElementRef } from "@angular/core";

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
 */
@Component({
  selector: "caliburn-dropdown-menu-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIslandComponent, CaliburnStackColComponent],
  template: `
    @if (menu.open()) {
      <div class="{{ hostClass() }}" data-testid="dropdown-menu" #menuRoot>
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
  readonly extraClass = input<string>("", { alias: "class" });

  /** fires on outside click or Escape, mirroring upstream's `onClickOutside`. */
  readonly closeOutside = output<void>();
  /** fires when any descendant item is selected, mirroring upstream's `onSelect`. */
  readonly itemSelected = output<Event>();

  private readonly menuRoot = viewChild<ElementRef<HTMLElement>>("menuRoot");

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
