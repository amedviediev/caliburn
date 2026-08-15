import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
} from "@angular/core";

import { KEYS, focusNearestParent } from "@excalidraw/common";

let nextProjectNameId = 0;

/**
 * Angular port of upstream `ProjectName.tsx`. The input id is built off a
 * per-instance counter, standing in for upstream's per-editor container id
 * (`useExcalidrawContainer().id`) — the value only has to pair the `<label>`
 * with its `<input>`.
 */
@Component({
  selector: "caliburn-project-name",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "ProjectName",
  },
  template: `
    <label class="ProjectName-label" [attr.for]="inputId">{{ label() }}:</label>
    <input
      type="text"
      class="TextInput"
      [id]="inputId"
      [value]="fileName()"
      (input)="fileName.set($any($event.target).value)"
      (blur)="handleBlur($event)"
      (keydown)="handleKeyDown($event)"
    />
  `,
})
export class CaliburnProjectNameComponent {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly ignoreFocus = input(false);

  readonly valueChange = output<string>();

  protected readonly inputId = `caliburn-project-name-${nextProjectNameId++}-filename`;
  protected readonly fileName = linkedSignal(() => this.value());

  handleBlur(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!this.ignoreFocus()) {
      focusNearestParent(target);
    }
    const value = target.value;
    if (value !== this.value()) {
      this.valueChange.emit(value);
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.ENTER) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      (event.currentTarget as HTMLElement).blur();
    }
  }
}
