import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { OnDestroy } from "@angular/core";

export const getTooltipDiv = (): HTMLDivElement => {
  const existingDiv = document.querySelector<HTMLDivElement>(
    ".excalidraw-tooltip",
  );
  if (existingDiv) {
    return existingDiv;
  }
  const div = document.createElement("div");
  document.body.appendChild(div);
  div.classList.add("excalidraw-tooltip");
  return div;
};

export const updateTooltipPosition = (
  tooltip: HTMLDivElement,
  item: { left: number; top: number; width: number; height: number },
  position: "bottom" | "top" = "bottom",
) => {
  const tooltipRect = tooltip.getBoundingClientRect();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const margin = 5;

  let left = item.left + item.width / 2 - tooltipRect.width / 2;
  if (left < 0) {
    left = margin;
  } else if (left + tooltipRect.width >= viewportWidth) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  let top: number;

  if (position === "bottom") {
    top = item.top + item.height + margin;
    if (top + tooltipRect.height >= viewportHeight) {
      top = item.top - tooltipRect.height - margin;
    }
  } else {
    top = item.top - tooltipRect.height - margin;
    if (top < 0) {
      top = item.top + item.height + margin;
    }
  }

  Object.assign(tooltip.style, {
    top: `${top}px`,
    left: `${left}px`,
  });
};

const updateTooltip = (
  item: HTMLElement,
  tooltip: HTMLDivElement,
  label: string,
  long: boolean,
) => {
  tooltip.classList.add("excalidraw-tooltip--visible");
  tooltip.style.minWidth = long ? "50ch" : "10ch";
  tooltip.style.maxWidth = long ? "50ch" : "15ch";

  tooltip.textContent = label;

  const itemRect = item.getBoundingClientRect();
  updateTooltipPosition(tooltip, itemRect);
};

/**
 * Angular port of upstream `Tooltip.tsx`. Host-bound (no wrapper element)
 * so the rendered DOM is exactly `.excalidraw-tooltip-wrapper`. Simplified
 * from upstream: when `disabled`, upstream renders no wrapper at all
 * (children render directly); here the wrapper still renders but is
 * functionally inert (no hover handlers attached) — content projection
 * can't conditionally omit a component's own host element.
 */
@Component({
  selector: "caliburn-tooltip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "excalidraw-tooltip-wrapper",
    "(pointerenter)": "onPointerEnter($event)",
    "(pointerleave)": "onPointerLeave()",
  },
  template: `<ng-content />`,
})
export class CaliburnTooltipComponent implements OnDestroy {
  readonly label = input.required<string>();
  readonly long = input(false);
  readonly disabled = input(false);

  onPointerEnter(event: PointerEvent) {
    if (this.disabled()) {
      return;
    }
    updateTooltip(
      event.currentTarget as HTMLElement,
      getTooltipDiv(),
      this.label(),
      this.long(),
    );
  }

  onPointerLeave() {
    getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
  }

  ngOnDestroy() {
    getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
  }
}
