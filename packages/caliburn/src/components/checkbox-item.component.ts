import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from "@angular/core";

import { NgIcon } from "@ng-icons/core";

/**
 * Angular port of upstream `CheckboxItem.tsx`. The host element IS upstream's
 * `.Checkbox` div, so a consumer's own class (upstream's `className`, e.g.
 * `LibraryUnit.tsx`'s `library-unit__checkbox`) lands on the same node.
 */
@Component({
  selector: "caliburn-checkbox-item",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  host: {
    class: "Checkbox",
    "[class.is-checked]": "checked()",
    "(click)": "onClick($event)",
  },
  templateUrl: "./checkbox-item.component.html",
})
export class CaliburnCheckboxItemComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly checked = input.required<boolean>();

  readonly checkedChange = output<{ checked: boolean; event: MouseEvent }>();

  onClick(event: MouseEvent) {
    this.checkedChange.emit({ checked: !this.checked(), event });
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(".Checkbox-box")
      ?.focus();
  }
}
