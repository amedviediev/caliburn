import { ChangeDetectionStrategy, Component } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import { CaliburnTooltipComponent } from "../../../packages/caliburn/src/index";

/**
 * Angular port of upstream
 * `excalidraw-app/components/EncryptedIcon.tsx` — the footer's end-to-end
 * encryption badge. The link is kept pointing at upstream's write-up: it
 * documents the very scheme this app's shareable links and collab rooms use.
 */
@Component({
  selector: "caliburn-app-encrypted-icon",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnTooltipComponent, NgIcon],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./encrypted-icon.component.html",
})
export class CaliburnAppEncryptedIconComponent {
  protected readonly linkLabel = t("encrypted.link");
  protected readonly tooltipLabel = t("encrypted.tooltip");
}
