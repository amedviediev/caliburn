import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from "@angular/core";

import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

/**
 * Angular port of upstream `Modal.tsx`. Portal-less: renders in place in the
 * component tree rather than via a `document.body`-appended portal — the
 * rendered DOM (`.Modal` / `.Modal__background` / `.Modal__content`,
 * `role="dialog"`, escape/backdrop close) is otherwise unchanged. Host-bound
 * (no wrapper element) so the rendered DOM root is exactly `.Modal`.
 */
@Component({
  selector: "caliburn-modal",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "hostClass()",
    role: "dialog",
    "aria-modal": "true",
    "[attr.aria-labelledby]": "labelledBy()",
    "(keydown)": "onKeydown($event)",
  },
  template: `
    <div class="Modal__background" (click)="onBackgroundClick()"></div>
    <div class="Modal__content" [style.--max-width]="maxWidthStyle()" tabindex="0">
      <ng-content />
    </div>
  `,
})
export class CaliburnModalComponent {
  readonly maxWidth = input<number>();
  readonly labelledBy = input.required<string>();
  readonly closeOnClickOutside = input(true);
  readonly extraClass = input<string>("", { alias: "class" });

  readonly closeRequest = output<void>();

  private readonly animationsDisabled = document.body.classList.contains(
    "excalidraw-animations-disabled",
  );

  readonly hostClass = computed(() =>
    clsx("Modal", this.extraClass(), {
      "animations-disabled": this.animationsDisabled,
    }),
  );

  readonly maxWidthStyle = computed(() => `${this.maxWidth()}px`);

  onBackgroundClick() {
    if (this.closeOnClickOutside()) {
      this.closeRequest.emit();
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      this.closeRequest.emit();
    }
  }
}
