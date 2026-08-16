import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { NgIcon } from "@ng-icons/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { provideCaliburnIcons } from "../icons";

import type { CaliburnViewportStatusFrame } from "./viewport-status-frame";
import type { TemplateRef } from "@angular/core";

let nextBadgeId = 0;

/**
 * Angular port of upstream `ViewportStatusFrame.tsx`'s
 * `ViewportStatusBadge` — the bottom-center pill a host paints through
 * `viewportStatusFrame.label` (follow mode's "Following <user>" badge).
 * Attribute-selector component so the rendered DOM is exactly upstream's
 * `<div class="viewport-status-frame__badge">`.
 */
@Component({
  selector: "div[caliburn-viewport-status-badge]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, NgTemplateOutlet],
  providers: [provideCaliburnIcons()],
  host: {
    class: "viewport-status-frame__badge",
    role: "status",
    "[class.viewport-status-frame__badge--clickable]": "!!label().onClick",
    "[style.--viewport-status-frame-badge-background]": "background()",
    "[style.color]": "label().color",
  },
  templateUrl: "./viewport-status-badge.component.html",
})
export class CaliburnViewportStatusBadgeComponent {
  readonly label =
    input.required<NonNullable<CaliburnViewportStatusFrame["label"]>>();
  readonly border = input<CaliburnViewportStatusFrame["border"]>(false);

  protected readonly labelId = `caliburn-viewport-status-badge-${nextBadgeId++}`;
  protected readonly closeLabel = t("buttons.close");

  protected readonly background = computed(
    () => this.label().background || this.border() || "var(--color-primary)",
  );

  protected readonly labelTemplate = computed(() =>
    typeof this.label().label === "string"
      ? null
      : (this.label().label as TemplateRef<unknown>),
  );

  protected readonly iconTemplate = computed(() => {
    const icon = this.label().icon;
    return icon && typeof icon !== "string" ? icon : null;
  });

  protected readonly iconName = computed(() => {
    const icon = this.label().icon;
    return typeof icon === "string" ? icon : null;
  });
}
