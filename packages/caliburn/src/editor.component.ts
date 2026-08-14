import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
} from "@angular/core";

@Component({
  selector: "caliburn-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="excalidraw excalidraw-container">
      <canvas class="excalidraw__canvas static"></canvas>
      <canvas class="excalidraw__canvas interactive"></canvas>
    </div>
  `,
})
export class CaliburnEditorComponent {
  readonly handleKeyboardGlobally = input(false);

  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
}
