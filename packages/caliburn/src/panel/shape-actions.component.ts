import { Component, forwardRef, inject } from "@angular/core";

import {
  CLASSES,
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
  DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
  DEFAULT_ELEMENT_STROKE_COLOR_PALETTE,
  FONT_FAMILY,
  FONT_SIZES,
  VERTICAL_ALIGN,
} from "@excalidraw/common";
import { getTargetElements } from "@excalidraw/element";

import { getShapeActionPredicates } from "@excalidraw/excalidraw/components/shapeActionPredicates";
import { t } from "@excalidraw/excalidraw/i18n";

import type { AppState } from "@excalidraw/excalidraw/types";

import { actionDeleteSelected } from "../actions/actionDeleteSelected";
import { actionDuplicateSelection } from "../actions/actionDuplicateSelection";
import { actionGroup, actionUngroup } from "../actions/actionGroup";
import {
  actionChangeBackgroundColor,
  actionChangeFillStyle,
  actionChangeFontFamily,
  actionChangeFontSize,
  actionChangeOpacity,
  actionChangeRoundness,
  actionChangeSloppiness,
  actionChangeStrokeColor,
  actionChangeStrokeStyle,
  actionChangeStrokeWidth,
  actionChangeTextAlign,
  actionChangeVerticalAlign,
} from "../actions/actionProperties";
import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "../actions/actionZindex";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import type { CaliburnEditorComponent } from "../editor.component";
import type { Action } from "@excalidraw/excalidraw/actions/types";

interface RadioOption {
  value: unknown;
  text: string;
  testId?: string;
}

const paletteSwatches = (
  palette: Record<string, string | readonly string[]>,
  shadeIndex: number,
) =>
  Object.entries(palette).map(([key, value]) => ({
    key,
    color: Array.isArray(value)
      ? (value[shadeIndex] as string)
      : (value as string),
  }));

/**
 * The Angular port of upstream `SelectedShapeActions` (Actions.tsx): the
 * properties panel driving the `actionProperties` actions. Controls carry the
 * same titles, aria-labels and testids as the upstream React components so
 * the upstream test suite drives them unchanged.
 */
@Component({
  selector: "caliburn-shape-actions",
  templateUrl: "./shape-actions.component.html",
})
export class CaliburnShapeActionsComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly editor = () => this.host;

  readonly shapeActionsMenuClass = CLASSES.SHAPE_ACTIONS_MENU;

  readonly labels = {
    stroke: t("labels.stroke"),
    background: t("labels.background"),
    fill: t("labels.fill"),
    strokeWidth: t("labels.strokeWidth"),
    strokeStyle: t("labels.strokeStyle"),
    sloppiness: t("labels.sloppiness"),
    edges: t("labels.edges"),
    fontFamily: t("labels.fontFamily"),
    fontSize: t("labels.fontSize"),
    textAlign: t("labels.textAlign"),
    opacity: t("labels.opacity"),
    layers: t("labels.layers"),
    actions: t("labels.actions"),
  };

  readonly strokeSwatches = paletteSwatches(
    DEFAULT_ELEMENT_STROKE_COLOR_PALETTE,
    DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
  );
  readonly backgroundSwatches = paletteSwatches(
    DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
    DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
  );

  readonly fillOptions: RadioOption[] = [
    { value: "hachure", text: t("labels.hachure"), testId: "fill-hachure" },
    {
      value: "cross-hatch",
      text: t("labels.crossHatch"),
      testId: "fill-cross-hatch",
    },
    { value: "solid", text: t("labels.solid"), testId: "fill-solid" },
  ];

  readonly strokeWidthOptions: RadioOption[] = [
    { value: "thin", text: t("labels.thin"), testId: "strokeWidth-thin" },
    { value: "medium", text: t("labels.medium"), testId: "strokeWidth-medium" },
    { value: "bold", text: t("labels.bold"), testId: "strokeWidth-bold" },
  ];

  readonly strokeStyleOptions: RadioOption[] = [
    { value: "solid", text: t("labels.strokeStyle_solid") },
    { value: "dashed", text: t("labels.strokeStyle_dashed") },
    { value: "dotted", text: t("labels.strokeStyle_dotted") },
  ];

  readonly sloppinessOptions: RadioOption[] = [
    { value: 0, text: t("labels.architect") },
    { value: 1, text: t("labels.artist") },
    { value: 2, text: t("labels.cartoonist") },
  ];

  readonly roundnessOptions: RadioOption[] = [
    { value: "sharp", text: t("labels.sharp") },
    { value: "round", text: t("labels.round") },
  ];

  readonly fontFamilyOptions: RadioOption[] = [
    {
      value: FONT_FAMILY.Excalifont,
      text: t("labels.handDrawn"),
      testId: "font-family-hand-drawn",
    },
    {
      value: FONT_FAMILY.Nunito,
      text: t("labels.normal"),
      testId: "font-family-normal",
    },
    {
      value: FONT_FAMILY["Comic Shanns"],
      text: t("labels.code"),
      testId: "font-family-code",
    },
  ];

  readonly fontSizeOptions: RadioOption[] = [
    { value: FONT_SIZES.sm, text: t("labels.small"), testId: "fontSize-small" },
    {
      value: FONT_SIZES.md,
      text: t("labels.medium"),
      testId: "fontSize-medium",
    },
    { value: FONT_SIZES.lg, text: t("labels.large"), testId: "fontSize-large" },
    {
      value: FONT_SIZES.xl,
      text: t("labels.veryLarge"),
      testId: "fontSize-veryLarge",
    },
  ];

  readonly textAlignOptions: RadioOption[] = [
    { value: "left", text: t("labels.left"), testId: "align-left" },
    {
      value: "center",
      text: t("labels.center"),
      testId: "align-horizontal-center",
    },
    { value: "right", text: t("labels.right"), testId: "align-right" },
  ];

  readonly verticalAlignOptions: RadioOption[] = [
    {
      value: VERTICAL_ALIGN.TOP,
      text: t("labels.alignTop"),
      testId: "align-top",
    },
    {
      value: VERTICAL_ALIGN.MIDDLE,
      text: t("labels.centerVertically"),
      testId: "align-middle",
    },
    {
      value: VERTICAL_ALIGN.BOTTOM,
      text: t("labels.alignBottom"),
      testId: "align-bottom",
    },
  ];

  readonly layerOptions = [
    { action: actionSendToBack, text: t("labels.sendToBack") },
    { action: actionSendBackward, text: t("labels.sendBackward") },
    { action: actionBringForward, text: t("labels.bringForward") },
    { action: actionBringToFront, text: t("labels.bringToFront") },
  ];

  readonly extraActionOptions = [
    { action: actionDuplicateSelection, text: t("labels.duplicateSelection") },
    { action: actionDeleteSelected, text: t("labels.delete") },
    { action: actionGroup, text: t("labels.group") },
    { action: actionUngroup, text: t("labels.ungroup") },
  ];

  readonly fillStyleAction = actionChangeFillStyle;
  readonly strokeWidthAction = actionChangeStrokeWidth;
  readonly strokeStyleAction = actionChangeStrokeStyle;
  readonly sloppinessAction = actionChangeSloppiness;
  readonly roundnessAction = actionChangeRoundness;
  readonly fontSizeAction = actionChangeFontSize;
  readonly textAlignAction = actionChangeTextAlign;
  readonly verticalAlignAction = actionChangeVerticalAlign;

  private targetElements() {
    const editor = this.editor();
    return getTargetElements(
      editor.scene.getNonDeletedElementsMap(),
      editor.state,
    );
  }

  predicates() {
    const editor = this.editor();
    return getShapeActionPredicates(
      editor.state,
      this.targetElements(),
      editor.scene.getNonDeletedElementsMap(),
      editor as any,
    );
  }

  visible() {
    this.host.changeGeneration();
    const editor = this.editor();
    const activeToolType = editor.state.activeTool.type;
    return (
      this.predicates().hasSelection ||
      editor.state.editingTextElement !== null ||
      (activeToolType !== "selection" &&
        activeToolType !== "eraser" &&
        activeToolType !== "hand" &&
        activeToolType !== "laser" &&
        activeToolType !== "lasso")
    );
  }

  currentStrokeColor() {
    return this.editor().state.currentItemStrokeColor;
  }

  currentBackgroundColor() {
    return this.editor().state.currentItemBackgroundColor;
  }

  currentOpacity() {
    return this.editor().state.currentItemOpacity;
  }

  togglePopup(popup: AppState["openPopup"]) {
    const editor = this.editor();
    editor.setState({
      openPopup: editor.state.openPopup === popup ? null : popup,
    });
  }

  execute(action: Action, value: unknown) {
    this.editor().actionManager.executeAction(action, "ui", value);
  }

  setStrokeColor(color: string) {
    this.execute(actionChangeStrokeColor, { currentItemStrokeColor: color });
  }

  setBackgroundColor(color: string) {
    this.execute(actionChangeBackgroundColor, {
      currentItemBackgroundColor: color,
    });
  }

  setFontFamily(value: unknown) {
    this.execute(actionChangeFontFamily, { currentItemFontFamily: value });
  }

  setOpacity(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.execute(actionChangeOpacity, value);
  }

  protected readonly COLOR_PALETTE = COLOR_PALETTE;
}
