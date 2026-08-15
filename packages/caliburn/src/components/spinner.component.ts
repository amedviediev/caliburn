import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

/**
 * Angular port of upstream `Spinner.tsx`. Not itself in the primitives
 * brief, but required for `IconButton`/`FilledButton`'s loading-state DOM
 * (`{props.isLoading && <Spinner />}`) to be byte-identical. Host-bound (no
 * wrapper element) so the rendered DOM is exactly `.Spinner`.
 */
@Component({
  selector: "caliburn-spinner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "Spinner",
  },
  template: `
    <svg
      viewBox="0 0 100 100"
      [style.width]="size()"
      [style.height]="size()"
      [style.--spinner-delay]="spinnerDelay()"
    >
      <circle
        cx="50"
        cy="50"
        [attr.r]="radius()"
        [attr.stroke-width]="circleWidth()"
        fill="none"
        stroke-miterlimit="10"
      />
    </svg>
  `,
})
export class CaliburnSpinnerComponent {
  readonly size = input<string | number>("1em");
  readonly circleWidth = input(8);
  readonly synchronized = input(false);

  private readonly mountTime = Date.now();
  private readonly mountDelay = -(this.mountTime % 1600);

  readonly radius = computed(() => 50 - this.circleWidth() / 2);
  readonly spinnerDelay = computed(() =>
    this.synchronized() ? `${this.mountDelay}ms` : 0,
  );
}
