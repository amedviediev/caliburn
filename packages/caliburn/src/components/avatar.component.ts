import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from "@angular/core";

import { getNameInitial } from "@excalidraw/excalidraw/clients";

/**
 * Angular port of upstream `Avatar.tsx` — the collaborator avatar (initial,
 * or the avatar image when the collaborator has one). Attribute-selector
 * component so the rendered DOM is exactly upstream's
 * `<div class="Avatar">`; `class` set by the consumer lands on that same
 * element, standing in for upstream's `className` prop.
 */
@Component({
  selector: "div[caliburn-avatar]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "Avatar",
    "[style.background]": "loadImg() ? null : color()",
    "(click)": "select.emit($event)",
  },
  templateUrl: "./avatar.component.html",
})
export class CaliburnAvatarComponent {
  readonly color = input.required<string>();
  readonly name = input.required<string>();
  readonly src = input<string | undefined>(undefined);

  readonly select = output<MouseEvent>();

  protected readonly error = signal(false);

  protected readonly shortName = computed(() => getNameInitial(this.name()));

  protected readonly loadImg = computed(() => !this.error() && this.src());

  protected onError() {
    this.error.set(true);
  }
}
