import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { NgIcon } from "@ng-icons/core";

import { provideCaliburnIcons } from "./icons";

/**
 * Angular port of upstream `QuickSearch.tsx` — the filter input the
 * UserList dropdown shows once the room is crowded. Attribute-selector
 * component so the rendered DOM is exactly upstream's
 * `<div class="QuickSearch__wrapper">`.
 */
@Component({
  selector: "div[caliburn-quick-search]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideCaliburnIcons()],
  host: {
    class: "QuickSearch__wrapper",
  },
  templateUrl: "./quick-search.component.html",
})
export class CaliburnQuickSearchComponent {
  readonly placeholder = input.required<string>();

  readonly termChange = output<string>();

  protected onInput(event: Event) {
    this.termChange.emit(
      (event.target as HTMLInputElement).value.trim().toLowerCase(),
    );
  }
}
