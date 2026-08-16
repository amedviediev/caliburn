import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import { translated } from "../i18n";

import { CaliburnTooltipComponent } from "./tooltip.component";

/** Angular port of upstream `HelpButton.tsx` — the footer's "?" button. */
@Component({
  selector: "caliburn-help-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnTooltipComponent, NgIcon],
  templateUrl: "./help-button.component.html",
})
export class CaliburnHelpButtonComponent {
  readonly onClick = input<() => void>();

  protected readonly label = translated(() => t("helpDialog.title"));
  protected readonly tooltip = translated(() => `${t("helpDialog.title")} — ?`);
}
