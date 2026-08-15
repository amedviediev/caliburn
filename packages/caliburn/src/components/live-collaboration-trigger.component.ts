import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
} from "@angular/core";

import { MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnButtonComponent } from "./button.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream
 * `live-collaboration/LiveCollaborationTrigger.tsx` — the top-right "Share"
 * button a host app renders through the editor's `topRightUI` slot.
 */
@Component({
  selector: "caliburn-live-collaboration-trigger",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnButtonComponent, NgIcon],
  templateUrl: "./live-collaboration-trigger.component.html",
})
export class CaliburnLiveCollaborationTriggerComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly isCollaborating = input(false);

  readonly select = output<void>();

  protected readonly title = t("labels.liveCollaboration");
  protected readonly shareLabel = t("labels.share");

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected readonly showIconOnly = computed(
    () =>
      this.editor.editorInterface.formFactor !== "desktop" ||
      this.state().width < MQ_MIN_WIDTH_DESKTOP,
  );

  protected readonly collaboratorCount = computed(
    () => this.state().collaborators.size,
  );
}
