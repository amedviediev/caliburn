import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

/**
 * Angular port of upstream `FixedSideContainer.tsx`. Host-bound (no wrapper
 * element) so the rendered DOM is exactly `.FixedSideContainer`.
 */
@Component({
  selector: "caliburn-fixed-side-container",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "hostClass()",
  },
  templateUrl: "./fixed-side-container.component.html",
})
export class CaliburnFixedSideContainerComponent {
  readonly side = input.required<"top" | "left" | "right">();

  readonly hostClass = computed(
    () => `FixedSideContainer FixedSideContainer_side_${this.side()}`,
  );
}
