import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Angular port of upstream `ScrollableList.tsx` — the scrolling list body
 * the UserList dropdown puts its collaborators in. Attribute-selector
 * component so the rendered DOM is exactly upstream's
 * `<div class="ScrollableList__wrapper" role="menu">`.
 *
 * Upstream derives emptiness from `Children.count(children)`; Angular can't
 * count projected content, so the (single) consumer passes it in.
 */
@Component({
  selector: "div[caliburn-scrollable-list]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "ScrollableList__wrapper",
    role: "menu",
  },
  templateUrl: "./scrollable-list.component.html",
})
export class CaliburnScrollableListComponent {
  readonly placeholder = input.required<string>();
  readonly isEmpty = input(false);
}
