import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Angular port of upstream `ColorPicker/PickerHeading.tsx`. Attribute-selector
 * component: the host IS upstream's `div.color-picker__heading`.
 */
@Component({
  selector: "div[caliburn-picker-heading]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "color-picker__heading" },
  templateUrl: "./picker-heading.component.html",
})
export class CaliburnPickerHeadingComponent {}
