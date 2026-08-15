import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Angular port of upstream `Island.tsx`. Host-bound (no wrapper element) so
 * the rendered DOM is exactly `.Island`, matching upstream — `> .Island`
 * combinators (see `css/styles.scss`) depend on there being no intervening
 * node.
 */
@Component({
  selector: "caliburn-island",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "Island",
    "[style.--padding]": "padding()",
    "[attr.data-viewport-ui]": "viewportUi()",
    "[attr.data-viewport-ui-name]": "viewportUiName()",
  },
  template: `<ng-content />`,
})
export class CaliburnIslandComponent {
  readonly padding = input<number>();
  readonly viewportUi = input<string>();
  readonly viewportUiName = input<string>();
}
