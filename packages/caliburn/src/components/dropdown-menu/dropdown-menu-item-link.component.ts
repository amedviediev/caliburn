import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from "@angular/core";

import {
  DROPDOWN_MENU_ITEM_SELECT_EVENT,
  getDropdownMenuItemClassName,
} from "./common";
import { CaliburnDropdownMenuContentComponent } from "./dropdown-menu-content.component";
import { CaliburnDropdownMenuItemContentComponent } from "./dropdown-menu-item-content.component";

/**
 * Angular port of upstream `dropdownMenu/DropdownMenuItemLink.tsx` — the
 * anchor sibling of `DropdownMenuItem`. Radix's `Item`/`asChild` wrapper is
 * dropped like it is on the button item; the anchor keeps upstream's
 * `target`/`rel`/`title` contract.
 *
 * Attribute-selector component (`a[caliburn-dropdown-menu-item-link]`) so the
 * `.dropdown-menu-item` element is a direct flex child of
 * `.dropdown-menu-container`.
 */
@Component({
  selector: "a[caliburn-dropdown-menu-item-link]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemContentComponent],
  host: {
    target: "_blank",
    "[attr.href]": "href()",
    "[attr.rel]": "'noopener ' + rel()",
    "[class]": "itemClass()",
    "[attr.title]": "title() ?? ariaLabel() ?? null",
    "[attr.aria-label]": "ariaLabel() ?? null",
    "[attr.data-testid]": "testId() ?? null",
    "(click)": "handleSelect($event)",
  },
  template: `
    <caliburn-dropdown-menu-item-content
      [icon]="icon()"
      [shortcut]="shortcut()"
      [mobile]="content?.mobile() ?? false"
    >
      <ng-content />
    </caliburn-dropdown-menu-item-content>
  `,
})
export class CaliburnDropdownMenuItemLinkComponent {
  protected readonly content = inject(CaliburnDropdownMenuContentComponent, {
    optional: true,
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly href = input.required<string>();
  readonly icon = input<string>();
  readonly shortcut = input<string>();
  readonly selected = input(false);
  readonly rel = input("noopener");
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
    if (!event.defaultPrevented) {
      this.host.nativeElement.dispatchEvent(
        new CustomEvent(DROPDOWN_MENU_ITEM_SELECT_EVENT, {
          bubbles: true,
          detail: event,
        }),
      );
    }
  }
}
