import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { ARROW_TYPE } from "@excalidraw/common";
import { isArrowElement } from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import {
  actionChangeArrowType,
  getFormValue,
} from "../actions/actionProperties";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import type { CaliburnEditorComponent } from "../editor.component";

type ArrowType = keyof typeof ARROW_TYPE;

interface ArrowTypeOption {
  value: ArrowType;
  text: string;
  icon: string;
  testId: string;
}

/**
 * Angular port of upstream `actionChangeArrowType`'s `PanelComponent`
 * (`actionProperties.tsx`) — the sharp / round / elbow radio group, rendered
 * by the full styles panel and by the compact panel's arrow popover.
 */
@Component({
  selector: "caliburn-arrow-type-fieldset",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  templateUrl: "./arrow-type-fieldset.component.html",
})
export class CaliburnArrowTypeFieldsetComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly legend = translated(() => t("labels.arrowtypes"));

  protected readonly options = translated<ArrowTypeOption[]>(() => [
    {
      value: ARROW_TYPE.sharp,
      text: t("labels.arrowtype_sharp"),
      icon: "sharpArrowIcon",
      testId: "sharp-arrow",
    },
    {
      value: ARROW_TYPE.round,
      text: t("labels.arrowtype_round"),
      icon: "roundArrowIcon",
      testId: "round-arrow",
    },
    {
      value: ARROW_TYPE.elbow,
      text: t("labels.arrowtype_elbowed"),
      icon: "elbowArrowIcon",
      testId: "elbow-arrow",
    },
  ]);

  protected value() {
    const editor = this.host;
    editor.changeGeneration();

    return getFormValue<ArrowType | null>(
      editor.scene.getElementsIncludingDeleted(),
      editor,
      (element) => {
        if (isArrowElement(element)) {
          return element.elbowed
            ? ARROW_TYPE.elbow
            : element.roundness
            ? ARROW_TYPE.round
            : ARROW_TYPE.sharp;
        }

        return null;
      },
      (element) => isArrowElement(element),
      (hasSelection) =>
        hasSelection ? null : editor.state.currentItemArrowType,
    );
  }

  protected select(value: ArrowType) {
    this.host.actionManager.executeAction(actionChangeArrowType, "ui", value);
  }
}
