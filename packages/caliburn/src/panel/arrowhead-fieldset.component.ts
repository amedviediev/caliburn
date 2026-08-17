import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { getArrowheadForPicker, isLinearElement } from "@excalidraw/element";

import { getLanguage, t } from "@excalidraw/excalidraw/i18n";
import { canHaveArrowheads } from "@excalidraw/excalidraw/scene";

import type { Arrowhead } from "@excalidraw/element/types";

import {
  actionChangeArrowhead,
  getFormValue,
} from "../actions/actionProperties";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnIconPickerComponent } from "../components/icon-picker.component";

import { translated } from "../i18n";

import type { IconPickerSection } from "../components/icon-picker.component";
import type { CaliburnEditorComponent } from "../editor.component";

/** upstream's `<ArrowheadFooIcon flip={flip} />`; the codegen names the
 * flipped variant of each icon `…Flipped` */
const arrowheadIcon = (name: string, flip: boolean) =>
  flip ? `${name}Flipped` : name;

/** upstream's `getArrowheadOptions` (`actionProperties.tsx`) */
const getArrowheadOptions = (
  flip: boolean,
): {
  visibleSections: IconPickerSection[];
  hiddenSections: IconPickerSection[];
} => {
  return {
    visibleSections: [
      {
        name: "default",
        options: [
          {
            value: null,
            text: t("labels.arrowhead_none"),
            keyBinding: "q",
            icon: arrowheadIcon("arrowheadNoneIcon", flip),
          },
          {
            value: "arrow",
            text: t("labels.arrowhead_arrow"),
            keyBinding: "w",
            icon: arrowheadIcon("arrowheadArrowIcon", flip),
          },
          {
            value: "triangle",
            text: t("labels.arrowhead_triangle"),
            icon: arrowheadIcon("arrowheadTriangleIcon", flip),
            keyBinding: "e",
          },
          {
            value: "triangle_outline",
            text: t("labels.arrowhead_triangle_outline"),
            icon: arrowheadIcon("arrowheadTriangleOutlineIcon", flip),
            keyBinding: "r",
          },
        ],
      },
    ],
    hiddenSections: [
      {
        name: "default",
        options: [
          {
            value: "circle",
            text: t("labels.arrowhead_circle"),
            keyBinding: "a",
            icon: arrowheadIcon("arrowheadCircleIcon", flip),
          },
          {
            value: "circle_outline",
            text: t("labels.arrowhead_circle_outline"),
            keyBinding: "s",
            icon: arrowheadIcon("arrowheadCircleOutlineIcon", flip),
          },
          {
            value: "diamond",
            text: t("labels.arrowhead_diamond"),
            icon: arrowheadIcon("arrowheadDiamondIcon", flip),
            keyBinding: "d",
          },
          {
            value: "diamond_outline",
            text: t("labels.arrowhead_diamond_outline"),
            icon: arrowheadIcon("arrowheadDiamondOutlineIcon", flip),
            keyBinding: "f",
          },
          {
            value: "bar",
            text: t("labels.arrowhead_bar"),
            keyBinding: "z",
            icon: arrowheadIcon("arrowheadBarIcon", flip),
          },
        ],
      },
      {
        name: t("labels.cardinality"),
        options: [
          {
            value: "cardinality_one",
            text: t("labels.arrowhead_cardinality_one"),
            icon: arrowheadIcon("arrowheadCardinalityOneIcon", flip),
            keyBinding: "x",
          },
          {
            value: "cardinality_many",
            text: t("labels.arrowhead_cardinality_many"),
            icon: arrowheadIcon("arrowheadCardinalityManyIcon", flip),
            keyBinding: "c",
          },
          {
            value: "cardinality_one_or_many",
            text: t("labels.arrowhead_cardinality_one_or_many"),
            icon: arrowheadIcon("arrowheadCardinalityOneOrManyIcon", flip),
            keyBinding: "v",
          },
          {
            value: "cardinality_exactly_one",
            text: t("labels.arrowhead_cardinality_exactly_one"),
            icon: arrowheadIcon("arrowheadCardinalityExactlyOneIcon", flip),
            keyBinding: null,
          },
          {
            value: "cardinality_zero_or_one",
            text: t("labels.arrowhead_cardinality_zero_or_one"),
            icon: arrowheadIcon("arrowheadCardinalityZeroOrOneIcon", flip),
            keyBinding: null,
          },
          {
            value: "cardinality_zero_or_many",
            text: t("labels.arrowhead_cardinality_zero_or_many"),
            icon: arrowheadIcon("arrowheadCardinalityZeroOrManyIcon", flip),
            keyBinding: null,
          },
        ],
      },
    ],
  };
};

/**
 * Angular port of upstream `actionChangeArrowhead`'s `PanelComponent`
 * (`actionProperties.tsx`) — the start/end arrowhead pickers, rendered by the
 * full styles panel and by the compact panel's arrow popover.
 */
@Component({
  selector: "caliburn-arrowhead-fieldset",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconPickerComponent],
  templateUrl: "./arrowhead-fieldset.component.html",
})
export class CaliburnArrowheadFieldsetComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly legend = translated(() => t("labels.arrowheads"));

  protected readonly startOptions = translated(() =>
    getArrowheadOptions(!getLanguage().rtl),
  );

  protected readonly endOptions = translated(() =>
    getArrowheadOptions(!!getLanguage().rtl),
  );

  protected startValue() {
    return this.arrowheadValue("start");
  }

  protected endValue() {
    return this.arrowheadValue("end");
  }

  private arrowheadValue(position: "start" | "end") {
    const editor = this.host;
    editor.changeGeneration();
    const currentItemArrowhead =
      position === "start"
        ? editor.state.currentItemStartArrowhead
        : editor.state.currentItemEndArrowhead;

    return getFormValue<Arrowhead | null>(
      editor.scene.getElementsIncludingDeleted(),
      editor,
      (element) =>
        isLinearElement(element) && canHaveArrowheads(element.type)
          ? getArrowheadForPicker(
              position === "start"
                ? element.startArrowhead
                : element.endArrowhead,
            )
          : currentItemArrowhead,
      true,
      (hasSelection) => (hasSelection ? null : currentItemArrowhead),
    );
  }

  protected select(position: "start" | "end", type: unknown) {
    this.host.actionManager.executeAction(actionChangeArrowhead, "ui", {
      position,
      type: type as Arrowhead,
    });
  }
}
