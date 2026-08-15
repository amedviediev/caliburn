import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Angular port of upstream `ButtonSeparator.tsx`. Host-bound (no wrapper
 * element); takes no props upstream.
 */
@Component({
  selector: "caliburn-button-separator",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style:
      "width: 1px; height: 1rem; background-color: var(--default-border-color); margin: 0 auto;",
  },
  template: ``,
})
export class CaliburnButtonSeparatorComponent {}
