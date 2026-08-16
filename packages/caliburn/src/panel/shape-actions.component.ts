import { Component, forwardRef, inject } from "@angular/core";

import {
  BUCKET_FILL_BACKGROUND_PICKS,
  CLASSES,
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_PICKS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
  FONT_SIZES,
  ROUNDNESS,
  THEME,
  VERTICAL_ALIGN,
} from "@excalidraw/common";
import {
  getBoundTextElement,
  getTargetElements,
  isArrowElement,
  isTextElement,
} from "@excalidraw/element";

import { getShapeActionPredicates } from "@excalidraw/excalidraw/components/shapeActionPredicates";
import { t } from "@excalidraw/excalidraw/i18n";
import { getSelectedElements } from "@excalidraw/excalidraw/scene";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import { NgIcon } from "@ng-icons/core";

import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawTextElement,
  StrokeVariability,
} from "@excalidraw/element/types";
import type { Action } from "@excalidraw/excalidraw/actions/types";
import type { Primitive } from "@excalidraw/excalidraw/types";

import { actionDeleteSelected } from "../actions/actionDeleteSelected";
import { actionDuplicateSelection } from "../actions/actionDuplicateSelection";
import { actionGroup, actionUngroup } from "../actions/actionGroup";
import {
  actionChangeBackgroundColor,
  actionChangeBucketFillBackgroundColor,
  actionChangeFillStyle,
  actionChangeFontFamily,
  actionChangeFontSize,
  actionChangeFreedrawMode,
  actionChangeOpacity,
  actionChangeRoundness,
  actionChangeSloppiness,
  actionChangeStrokeColor,
  actionChangeStrokeStyle,
  actionChangeStrokeWidth,
  actionChangeTextAlign,
  actionChangeVerticalAlign,
  getFormValue,
  getStrokeWidthKeyForElement,
} from "../actions/actionProperties";
import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "../actions/actionZindex";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { getActionIconName } from "../components/action-icons";
import { CaliburnColorPickerComponent } from "../components/color-picker/color-picker.component";

import type { CaliburnEditorComponent } from "../editor.component";

interface RadioOption {
  value: unknown;
  text: string;
  testId?: string;
  /** the ng-icon registry name of upstream's `RadioSelection` option `icon` */
  icon?: string;
}

/**
 * The Angular port of upstream `SelectedShapeActions` (Actions.tsx): the
 * properties panel driving the `actionProperties` actions. Controls carry the
 * same titles, aria-labels and testids as the upstream React components so
 * the upstream test suite drives them unchanged.
 */
@Component({
  selector: "caliburn-shape-actions",
  imports: [CaliburnColorPickerComponent, NgIcon],
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
    pressure: t("labels.pressure"),
    sloppiness: t("labels.sloppiness"),
    edges: t("labels.edges"),
    fontFamily: t("labels.fontFamily"),
    fontSize: t("labels.fontSize"),
    textAlign: t("labels.textAlign"),
    opacity: t("labels.opacity"),
    layers: t("labels.layers"),
    actions: t("labels.actions"),
  };

  readonly strokePalette = DEFAULT_ELEMENT_STROKE_COLOR_PALETTE;
  readonly backgroundPalette = DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE;
  readonly strokeTopPicks = DEFAULT_ELEMENT_STROKE_PICKS;
  readonly backgroundTopPicks = DEFAULT_ELEMENT_BACKGROUND_PICKS;
  readonly bucketFillTopPicks = BUCKET_FILL_BACKGROUND_PICKS;
  /** hidden rather than removed from the palette so the remaining colors
   * keep their usual hotkeys (w for white etc.) */
  readonly bucketFillExcludedColors = [COLOR_PALETTE.transparent];

  private readonly hachureSuffix = ` (${getShortcutKey("Alt-Click")})`;

  fillOptions(): RadioOption[] {
    return [
      {
        value: "hachure",
        text: `${
          this.allElementsZigZag() ? t("labels.zigzag") : t("labels.hachure")
        }${this.hachureSuffix}`,
        icon: this.allElementsZigZag() ? "fillZigZagIcon" : "fillHachureIcon",
        testId: "fill-hachure",
      },
      {
        value: "cross-hatch",
        text: t("labels.crossHatch"),
        icon: "fillCrossHatchIcon",
        testId: "fill-cross-hatch",
      },
      {
        value: "solid",
        text: t("labels.solid"),
        icon: "fillSolidIcon",
        testId: "fill-solid",
      },
    ];
  }

  readonly strokeWidthOptions: RadioOption[] = [
    {
      value: "thin",
      text: t("labels.thin"),
      icon: "strokeWidthBaseIcon",
      testId: "strokeWidth-thin",
    },
    {
      value: "medium",
      text: t("labels.medium"),
      icon: "strokeWidthBoldIcon",
      testId: "strokeWidth-medium",
    },
    {
      value: "bold",
      text: t("labels.bold"),
      icon: "strokeWidthExtraBoldIcon",
      testId: "strokeWidth-bold",
    },
  ];

  readonly strokeStyleOptions: RadioOption[] = [
    {
      value: "solid",
      text: t("labels.strokeStyle_solid"),
      icon: "strokeWidthBaseIcon",
    },
    {
      value: "dashed",
      text: t("labels.strokeStyle_dashed"),
      icon: "strokeStyleDashedIcon",
    },
    {
      value: "dotted",
      text: t("labels.strokeStyle_dotted"),
      icon: "strokeStyleDottedIcon",
    },
  ];

  readonly freedrawModeOptions: RadioOption[] = [
    {
      value: "constant",
      text: t("labels.pressure_constant"),
      icon: "strokeVariabilityConstantIcon",
    },
    {
      value: "variable",
      text: t("labels.pressure_variable"),
      icon: "strokeVariabilityVariableIcon",
    },
  ];

  readonly sloppinessOptions: RadioOption[] = [
    { value: 0, text: t("labels.architect"), icon: "sloppinessArchitectIcon" },
    { value: 1, text: t("labels.artist"), icon: "sloppinessArtistIcon" },
    {
      value: 2,
      text: t("labels.cartoonist"),
      icon: "sloppinessCartoonistIcon",
    },
  ];

  readonly roundnessOptions: RadioOption[] = [
    { value: "sharp", text: t("labels.sharp"), icon: "edgeSharpIcon" },
    { value: "round", text: t("labels.round"), icon: "edgeRoundIcon" },
  ];

  readonly fontFamilyOptions: RadioOption[] = [
    {
      value: FONT_FAMILY.Excalifont,
      text: t("labels.handDrawn"),
      icon: "freedrawIcon",
      testId: "font-family-hand-drawn",
    },
    {
      value: FONT_FAMILY.Nunito,
      text: t("labels.normal"),
      icon: "fontFamilyNormalIcon",
      testId: "font-family-normal",
    },
    {
      value: FONT_FAMILY["Comic Shanns"],
      text: t("labels.code"),
      icon: "fontFamilyCodeIcon",
      testId: "font-family-code",
    },
  ];

  readonly fontSizeOptions: RadioOption[] = [
    {
      value: FONT_SIZES.sm,
      text: t("labels.small"),
      icon: "fontSizeSmallIcon",
      testId: "fontSize-small",
    },
    {
      value: FONT_SIZES.md,
      text: t("labels.medium"),
      icon: "fontSizeMediumIcon",
      testId: "fontSize-medium",
    },
    {
      value: FONT_SIZES.lg,
      text: t("labels.large"),
      icon: "fontSizeLargeIcon",
      testId: "fontSize-large",
    },
    {
      value: FONT_SIZES.xl,
      text: t("labels.veryLarge"),
      icon: "fontSizeExtraLargeIcon",
      testId: "fontSize-veryLarge",
    },
  ];

  readonly textAlignOptions: RadioOption[] = [
    {
      value: "left",
      text: t("labels.left"),
      icon: "textAlignLeftIcon",
      testId: "align-left",
    },
    {
      value: "center",
      text: t("labels.center"),
      icon: "textAlignCenterIcon",
      testId: "align-horizontal-center",
    },
    {
      value: "right",
      text: t("labels.right"),
      icon: "textAlignRightIcon",
      testId: "align-right",
    },
  ];

  /** upstream themes these (`<TextAlignTopIcon theme={appState.theme} />`),
   * so the icon name is resolved per-render by `verticalAlignIcon()` rather
   * than baked in here. */
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

  /** upstream's `<TextAlignTopIcon theme={appState.theme} />` triple —
   * themed, so resolved per-render rather than baked into the option. */
  verticalAlignIcon(option: RadioOption): string {
    const isDark = this.editor().state.theme === THEME.DARK;
    switch (option.value) {
      case VERTICAL_ALIGN.TOP:
        return isDark ? "textAlignTopIconDark" : "textAlignTopIconLight";
      case VERTICAL_ALIGN.BOTTOM:
        return isDark ? "textAlignBottomIconDark" : "textAlignBottomIconLight";
      default:
        return isDark ? "textAlignMiddleIconDark" : "textAlignMiddleIconLight";
    }
  }

  /** the layers/actions rows render upstream's `renderAction(...)`, whose
   * icon comes off the action itself (also themed for group/ungroup) —
   * shared with the command palette's identical resolution. */
  actionIcon(action: Action) {
    return getActionIconName(action, this.editor().state, this.elements());
  }

  readonly fillStyleAction = actionChangeFillStyle;
  readonly strokeWidthAction = actionChangeStrokeWidth;
  readonly strokeStyleAction = actionChangeStrokeStyle;
  readonly freedrawModeAction = actionChangeFreedrawMode;
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

  /** the `elements` an upstream `PanelComponent` is handed (`manager.tsx`) */
  private elements() {
    return this.editor().scene.getElementsIncludingDeleted();
  }

  private formValue<T extends Primitive>(
    getValue: (element: ExcalidrawElement) => T,
    elementPredicate: true | ((element: ExcalidrawElement) => boolean),
    defaultValue: T | ((isSomeElementSelected: boolean) => T),
  ): T {
    return getFormValue(
      this.elements(),
      this.editor(),
      getValue,
      elementPredicate,
      defaultValue,
    );
  }

  allElementsZigZag() {
    const editor = this.editor();
    const selectedElements = getSelectedElements(this.elements(), editor.state);
    return (
      selectedElements.length > 0 &&
      selectedElements.every((el) => el.fillStyle === "zigzag")
    );
  }

  fillStyleValue() {
    return this.formValue(
      (element) => element.fillStyle,
      (element) => element.hasOwnProperty("fillStyle"),
      (hasSelection) =>
        hasSelection ? null : this.editor().state.currentItemFillStyle,
    );
  }

  /** upstream's `active` override: zigzag lights the hachure entry up */
  fillStyleActive(option: RadioOption) {
    if (option.value === "hachure" && this.allElementsZigZag()) {
      return true;
    }
    return this.fillStyleValue() === option.value;
  }

  setFillStyle(option: RadioOption, event: MouseEvent) {
    const selectedElements = getSelectedElements(
      this.elements(),
      this.editor().state,
    );
    const nextValue =
      event.altKey &&
      option.value === "hachure" &&
      selectedElements.every((el) => el.fillStyle === "hachure")
        ? "zigzag"
        : option.value;

    this.execute(this.fillStyleAction, nextValue);
  }

  strokeWidthValue() {
    return this.formValue(
      getStrokeWidthKeyForElement,
      (element) => element.hasOwnProperty("strokeWidth"),
      (hasSelection) =>
        hasSelection ? null : this.editor().state.currentItemStrokeWidthKey,
    );
  }

  strokeStyleValue() {
    return this.formValue(
      (element) => element.strokeStyle,
      (element) => element.hasOwnProperty("strokeStyle"),
      (hasSelection) =>
        hasSelection ? null : this.editor().state.currentItemStrokeStyle,
    );
  }

  freedrawModeValue() {
    return (
      this.formValue<StrokeVariability | null>(
        (element) =>
          (element as ExcalidrawFreeDrawElement).strokeOptions?.variability ??
          null,
        (element) => element.type === "freedraw",
        (hasSelection) =>
          hasSelection
            ? null
            : this.editor().state.currentItemStrokeVariability,
      ) ?? this.editor().state.currentItemStrokeVariability
    );
  }

  sloppinessValue() {
    return this.formValue(
      (element) => element.roughness,
      (element) => element.hasOwnProperty("roughness"),
      (hasSelection) =>
        hasSelection ? null : this.editor().state.currentItemRoughness,
    );
  }

  roundnessValue() {
    const hasLegacyRoundness = this.targetElements().some(
      (el) => el.roundness?.type === ROUNDNESS.LEGACY,
    );

    return this.formValue<"sharp" | "round" | null>(
      (element) =>
        hasLegacyRoundness ? null : element.roundness ? "round" : "sharp",
      (element) =>
        !isArrowElement(element) && element.hasOwnProperty("roundness"),
      (hasSelection) =>
        hasSelection ? null : this.editor().state.currentItemRoundness,
    );
  }

  private boundTextValue<T extends Primitive>(
    fromText: (element: ExcalidrawTextElement) => T,
    defaultValue: T | ((isSomeElementSelected: boolean) => T),
  ): T {
    const elementsMap = this.editor().scene.getNonDeletedElementsMap();
    return this.formValue(
      (element) => {
        if (isTextElement(element)) {
          return fromText(element);
        }
        const boundTextElement = getBoundTextElement(element, elementsMap);
        if (boundTextElement) {
          return fromText(boundTextElement);
        }
        return null as T;
      },
      (element) =>
        isTextElement(element) ||
        getBoundTextElement(element, elementsMap) !== null,
      defaultValue,
    );
  }

  fontFamilyValue() {
    return this.boundTextValue(
      (element) => element.fontFamily,
      (hasSelection) =>
        hasSelection
          ? null
          : this.editor().state.currentItemFontFamily || DEFAULT_FONT_FAMILY,
    );
  }

  fontSizeValue() {
    return this.boundTextValue(
      (element) => element.fontSize,
      (hasSelection) =>
        hasSelection
          ? null
          : this.editor().state.currentItemFontSize || DEFAULT_FONT_SIZE,
    );
  }

  textAlignValue() {
    return this.boundTextValue(
      (element) => element.textAlign,
      (hasSelection) =>
        hasSelection ? null : this.editor().state.currentItemTextAlign,
    );
  }

  verticalAlignValue() {
    const elementsMap = this.editor().scene.getNonDeletedElementsMap();
    return this.formValue(
      (element) => {
        if (isTextElement(element) && element.containerId) {
          return element.verticalAlign;
        }
        const boundTextElement = getBoundTextElement(element, elementsMap);
        if (boundTextElement) {
          return boundTextElement.verticalAlign;
        }
        return null;
      },
      (element) =>
        isTextElement(element) ||
        getBoundTextElement(element, elementsMap) !== null,
      (hasSelection) => (hasSelection ? null : VERTICAL_ALIGN.MIDDLE),
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

  /** upstream's bucket-fill branch of `SelectedShapeActions` (Actions.tsx):
   * the tool configures only the fill it creates — color, fill style and
   * opacity (shared `currentItem*` values; no stroke properties) */
  isBucketFillTool() {
    return this.editor().state.activeTool.type === "bucketfill";
  }

  bucketFillBackgroundColor() {
    const editor = this.editor();
    return editor.bucketFill.getBucketFillBackgroundColor(
      editor.state.currentItemBackgroundColor,
    );
  }

  readonly updateBucketFillBackgroundColor = (formData?: any) => {
    this.execute(actionChangeBucketFillBackgroundColor, formData);
  };

  setBucketFillBackgroundColor(color: string) {
    this.updateBucketFillBackgroundColor({
      currentItemBackgroundColor: color,
    });
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

  execute(action: Action, value: unknown) {
    this.editor().actionManager.executeAction(action, "ui", value);
  }

  /** upstream's `updateData` for the two color pickers: the raw action
   * dispatcher, which the picker also drives `appState.openPopup` through */
  readonly updateStrokeColor = (formData?: any) => {
    this.execute(actionChangeStrokeColor, formData);
  };

  readonly updateBackgroundColor = (formData?: any) => {
    this.execute(actionChangeBackgroundColor, formData);
  };

  setStrokeColor(color: string) {
    this.updateStrokeColor({ currentItemStrokeColor: color });
  }

  setBackgroundColor(color: string) {
    this.updateBackgroundColor({ currentItemBackgroundColor: color });
  }

  setFontFamily(value: unknown) {
    this.execute(actionChangeFontFamily, { currentItemFontFamily: value });
  }

  /**
   * Bound to both `input` and `change` — React maps `onChange` on a range
   * input onto the `input` event, so upstream's single handler answers
   * either; the guard keeps a browser's `input`-then-`change` pair from
   * running the action twice.
   */
  setOpacity(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (value === this.currentOpacity()) {
      return;
    }
    this.execute(actionChangeOpacity, value);
  }
}
