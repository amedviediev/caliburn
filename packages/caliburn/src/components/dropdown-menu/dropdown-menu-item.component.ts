import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from "@angular/core";

import { getDropdownMenuItemClassName } from "./common";
import { CaliburnDropdownMenuContentComponent } from "./dropdown-menu-content.component";
import { CaliburnDropdownMenuItemContentComponent } from "./dropdown-menu-item-content.component";

export type DropdownMenuItemBadgeType = "green" | "red" | "blue";

/**
 * Angular port of upstream `DropdownMenuItem.tsx`'s co-located
 * `DropDownMenuItemBadge` (`DropdownMenuItem.Badge`). `theme` replaces
 * `useExcalidrawAppState()`, see other primitives' `mobile`/`fullscreen`
 * inputs for the same host-agnostic rationale.
 */
@Component({
  selector: "caliburn-dropdown-menu-item-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "DropDownMenuItemBadge",
    "[style]": "hostStyle()",
  },
  template: `<ng-content />`,
})
export class CaliburnDropdownMenuItemBadgeComponent {
  readonly type = input<DropdownMenuItemBadgeType>("blue");
  readonly theme = input<"light" | "dark">("light");

  readonly hostStyle = computed(() => {
    const border = this.theme() === "light" ? "1.5px solid white" : "none";
    const base = `display: inline-flex; margin-left: auto; padding: 2px 4px; border-radius: 6px; font-size: 9px; font-family: Cascadia, monospace; border: ${border};`;
    switch (this.type()) {
      case "green":
        return `${base} background-color: var(--background-color-badge); color: var(--color-badge);`;
      case "red":
        return `${base} background-color: pink; color: darkred;`;
      case "blue":
      default:
        return `${base} background: var(--color-promo); color: var(--color-surface-lowest);`;
    }
  });
}

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuItem.tsx`. Radix's
 * `DropdownMenuPrimitive.Item` (`asChild`, `role="menuitem"`) is dropped per
 * the brief — only the inner `<button>` and its classes/data-testid are
 * preserved. `select` composes with the parent content's shared
 * `itemSelected` (upstream's `composeEventHandlers(onSelect,
 * DropdownMenuContentProps.onSelect)`), injected directly (optional, no
 * `forwardRef` needed — no import cycle).
 */
@Component({
  selector: "caliburn-dropdown-menu-item",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemContentComponent],
  template: `
    <button
      type="button"
      [class]="itemClass()"
      [attr.value]="value() ?? null"
      [attr.title]="title() ?? ariaLabel() ?? null"
      [attr.aria-label]="ariaLabel() ?? null"
      [attr.data-testid]="testId() ?? null"
      [disabled]="disabled()"
      (click)="handleSelect($event)"
    >
      <caliburn-dropdown-menu-item-content
        [icon]="icon()"
        [shortcut]="shortcut()"
        [hasBadge]="hasBadge()"
        [mobile]="content?.mobile() ?? false"
      >
        <ng-content />
        <ng-content
          select="[dropdown-menu-item-badge-slot]"
          ngProjectAs="[dropdown-menu-item-badge-slot]"
        />
      </caliburn-dropdown-menu-item-content>
    </button>
  `,
})
export class CaliburnDropdownMenuItemComponent {
  protected readonly content = inject(CaliburnDropdownMenuContentComponent, {
    optional: true,
  });

  readonly icon = input<string>();
  readonly hasBadge = input(false);
  readonly value = input<string | number>();
  readonly shortcut = input<string>();
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly title = input<string>();
  readonly ariaLabel = input<string>();
  readonly testId = input<string>();
  readonly extraClass = input<string>("", { alias: "class" });

  readonly select = output<Event>();

  readonly itemClass = computed(() =>
    getDropdownMenuItemClassName(this.extraClass(), this.selected()),
  );

  handleSelect(event: Event) {
    this.select.emit(event);
    this.content?.itemSelected.emit(event);
  }
}
