import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { NgIcon } from "@ng-icons/core";

/**
 * Angular port of upstream `Stats/Collapsible.tsx`. The label is projected
 * into the header (`[collapsibleLabel]`), the body through the default slot;
 * upstream's `className` prop has no caliburn call site and is not ported.
 */
@Component({
  selector: "caliburn-stats-collapsible",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  templateUrl: "./collapsible.component.html",
})
export class CaliburnStatsCollapsibleComponent {
  // having it controlled so that the state is managed outside
  // this is to keep the user's previous choice even when the
  // Collapsible is unmounted
  readonly open = input.required<boolean>();
  readonly showCollapsedIcon = input(true);

  readonly openTrigger = output<void>();
}
