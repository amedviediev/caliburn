import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from "@angular/core";

import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

import { createPortalContainer } from "./create-portal-container";

import type { OnInit } from "@angular/core";

/**
 * Angular port of upstream `Modal.tsx`. Host-bound (no wrapper element) so
 * the rendered DOM root is exactly `.Modal`, and relocated into the
 * `document.body`-level `.excalidraw.excalidraw-modal-container` portal
 * (`createPortalContainer`) — Angular has no `createPortal`, so the host
 * element is moved once its own view exists, which lands the same subtree in
 * the same place as upstream's React portal. Living at body level with the
 * container's `z-index: var(--zIndex-modal)` is what puts the modal above the
 * editor's canvases and UI layer, exactly as upstream.
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
  templateUrl: "./modal.component.html",
})
export class CaliburnModalComponent implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly portalContainer = createPortalContainer(
    "excalidraw-modal-container",
  );

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

  ngOnInit() {
    // by now the component's own view (and anything projected into it) is
    // built, so moving the host carries the whole modal across in one piece
    this.portalContainer.appendChild(this.host.nativeElement);
  }

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
