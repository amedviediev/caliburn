import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  inject,
  signal,
  viewChild,
} from "@angular/core";

import {
  KEYS,
  capitalizeString,
  supportsResizeObserver,
} from "@excalidraw/common";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  TOOLS,
  getToolLetter,
  getToolShortcut,
} from "@excalidraw/excalidraw/components/Tools";
import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import type { ToolbarToolType } from "@excalidraw/excalidraw/components/Tools";

import type { PointerType } from "@excalidraw/element/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import { CaliburnDropdownMenuContentComponent } from "./dropdown-menu/dropdown-menu-content.component";
import { CaliburnDropdownMenuItemComponent } from "./dropdown-menu/dropdown-menu-item.component";
import { CaliburnDropdownMenuTriggerComponent } from "./dropdown-menu/dropdown-menu-trigger.component";
import { CaliburnDropdownMenuComponent } from "./dropdown-menu/dropdown-menu.component";
import { CaliburnFreedrawToolPopoverComponent } from "./freedraw-tool-popover.component";
import { CaliburnIconButtonComponent } from "./icon-button.component";
import { CaliburnSelectionToolPopoverComponent } from "./selection-tool-popover.component";
import { CaliburnToolPopoverComponent } from "./tool-popover.component";
import { TOOL_ICONS } from "./tools";

import type { CaliburnToolOption } from "./tool-popover.component";
import type { CaliburnEditorComponent } from "../editor.component";
import type { AfterViewInit, OnDestroy, ElementRef } from "@angular/core";

type ToolButtonView = {
  type: ToolbarToolType;
  icon: string;
  fillable: boolean;
  title: string;
  ariaLabel: string;
  shortcut: string | null;
  keyBindingLabel: string | null;
  testId: string;
  checked: boolean;
  disabled: boolean;
};

type GenericShape = "rectangle" | "diamond" | "ellipse";
type LinearElement = "arrow" | "line";

/** upstream's per-button width and gap, the basis of the overflow maths */
const WIDTH = 36;
const GAP = 4;
// hand, selection, freedraw, eraser, rectangle, arrow, others
const MIN_TOOLS = 7;
const MIN_WIDTH = MIN_TOOLS * WIDTH + (MIN_TOOLS - 1) * GAP;
const ADDITIONAL_WIDTH = WIDTH + GAP;

/**
 * Angular port of upstream `MobileToolbar.tsx` — the compact bottom toolbar
 * of the phone layout. It measures itself and promotes the text, image and
 * frame tools out of the overflow dropdown as room appears; upstream re-reads
 * the width from a ref callback on every render, which a `ResizeObserver` on
 * the toolbar stands in for here (the same `supportsResizeObserver` guard the
 * editor's container observer uses).
 *
 * Of the dropdown's "Generate" section only the un-gated mermaid-to-excalidraw
 * entry is ported, exactly as in the desktop `toolbar.component.ts`: the other
 * two are AI surfaces upstream gates on `app.props.aiEnabled` — the
 * `TTDDialogTriggerTunnel.Out` slot a Plus host fills, and `magicframe`, which
 * additionally needs `app.plugins.diagramToCode`. Neither has a caliburn
 * equivalent, so `magicframe` is also absent from the overflow list that
 * decides whether the trigger renders selected.
 */
@Component({
  selector: "caliburn-mobile-toolbar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    CaliburnDropdownMenuComponent,
    CaliburnDropdownMenuContentComponent,
    CaliburnDropdownMenuItemComponent,
    CaliburnDropdownMenuTriggerComponent,
    CaliburnFreedrawToolPopoverComponent,
    CaliburnIconButtonComponent,
    CaliburnSelectionToolPopoverComponent,
    CaliburnToolPopoverComponent,
  ],
  templateUrl: "./mobile-toolbar.component.html",
})
export class CaliburnMobileToolbarComponent
  implements AfterViewInit, OnDestroy
{
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private readonly toolbarRef =
    viewChild<ElementRef<HTMLDivElement>>("toolbar");

  protected readonly triggerWidth = WIDTH;

  protected readonly labels = translated(() => ({
    extraTools: t("toolBar.extraTools"),
    text: t("toolBar.text"),
    image: t("toolBar.image"),
    frame: t("toolBar.frame"),
    embeddable: t("toolBar.embeddable"),
    autoshape: t("toolBar.autoshape"),
    laser: t("toolBar.laser"),
    bucketfill: t("toolBar.bucketfill"),
    mermaidToExcalidraw: t("toolBar.mermaidToExcalidraw"),
  }));

  private readonly toolbarWidth = signal(0);
  private resizeObserver: ResizeObserver | null = null;

  private readonly otherShapesMenuOpen = signal(false);
  protected readonly extraToolsOpen = this.otherShapesMenuOpen.asReadonly();

  private readonly lastActiveGenericShape = signal<GenericShape>("rectangle");
  private readonly lastActiveLinearElement = signal<LinearElement>("arrow");

  protected readonly shapeTools = translated<CaliburnToolOption[]>(() =>
    (["rectangle", "diamond", "ellipse"] as const).map((type) => ({
      type,
      icon: TOOL_ICONS[type],
      title: capitalizeString(t(`toolBar.${type}`)),
      fillable: TOOLS[type].fillable,
    })),
  );

  protected readonly linearElementTools = translated<CaliburnToolOption[]>(() =>
    (["arrow", "line"] as const).map((type) => ({
      type,
      icon: TOOL_ICONS[type],
      title: capitalizeString(t(`toolBar.${type}`)),
      fillable: TOOLS[type].fillable,
    })),
  );

  constructor() {
    // upstream keeps both memories in sync with the active tool so that
    // switching through other UI updates what the trigger displays
    effect(() => {
      this.editor.changeGeneration();
      const type = this.editor.state.activeTool.type;
      if (type === "rectangle" || type === "diamond" || type === "ellipse") {
        this.lastActiveGenericShape.set(type);
      }
      if (type === "arrow" || type === "line") {
        this.lastActiveLinearElement.set(type);
      }
    });
  }

  ngAfterViewInit() {
    const toolbar = this.toolbarRef()?.nativeElement;
    if (!toolbar) {
      return;
    }
    this.toolbarWidth.set(toolbar.getBoundingClientRect().width);
    if (!supportsResizeObserver) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.toolbarWidth.set(toolbar.getBoundingClientRect().width);
    });
    this.resizeObserver.observe(toolbar);
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  protected showTextToolOutside() {
    return this.toolbarWidth() >= MIN_WIDTH + 1 * ADDITIONAL_WIDTH;
  }

  protected showImageToolOutside() {
    return this.toolbarWidth() >= MIN_WIDTH + 2 * ADDITIONAL_WIDTH;
  }

  protected showFrameToolOutside() {
    return this.toolbarWidth() >= MIN_WIDTH + 3 * ADDITIONAL_WIDTH;
  }

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  private isToolButtonDisabled(type: string) {
    const forcedTool = this.editor.activeTool();
    return forcedTool != null && forcedTool.type !== type;
  }

  /**
   * `hideShortcut` is upstream's flag for "no keyboard here": it drops the
   * tooltip hint, `aria-keyshortcuts` and the keybinding badge alike. Every
   * button in this toolbar sets it except the hand tool, which upstream passes
   * only `hideKeyBinding` — so it keeps "Hand — H" and its `aria-keyshortcuts`
   * and loses just the corner badge.
   */
  protected toolButton(
    type: ToolbarToolType,
    { hideShortcut = true, hideKeyBinding = false } = {},
  ): ToolButtonView {
    const label = capitalizeString(t(`toolBar.${type}`));
    const shortcut = hideShortcut ? null : getToolShortcut(type);
    return {
      type,
      icon: TOOL_ICONS[type],
      fillable: TOOLS[type].fillable === true,
      title: shortcut ? `${label} — ${shortcut}` : label,
      ariaLabel: label,
      shortcut,
      keyBindingLabel:
        hideKeyBinding || hideShortcut
          ? null
          : TOOLS[type].numericKey || getToolLetter(type) || null,
      testId: `toolbar-${type}`,
      checked: this.state().activeTool.type === type,
      disabled: this.isToolButtonDisabled(type),
    };
  }

  protected genericShapeOption(): CaliburnToolOption {
    const tools = this.shapeTools();
    return (
      tools.find((tool) => tool.type === this.lastActiveGenericShape()) ??
      tools[0]
    );
  }

  protected genericShapeDefault(): ToolbarToolType {
    return this.lastActiveGenericShape();
  }

  protected onGenericShapeChange(type: ToolbarToolType) {
    if (type === "rectangle" || type === "diamond" || type === "ellipse") {
      this.lastActiveGenericShape.set(type);
      this.editor.setActiveTool({ type });
    }
  }

  protected linearElementOption(): CaliburnToolOption {
    const tools = this.linearElementTools();
    return (
      tools.find((tool) => tool.type === this.lastActiveLinearElement()) ??
      tools[0]
    );
  }

  protected linearElementDefault(): ToolbarToolType {
    return this.lastActiveLinearElement();
  }

  protected onLinearElementChange(type: ToolbarToolType) {
    if (type === "arrow" || type === "line") {
      this.lastActiveLinearElement.set(type);
      this.editor.setActiveTool({ type });
    }
  }

  /** the tools that live behind the overflow trigger, minus the ones room has
   * been found for outside it */
  private extraTools(): ToolbarToolType[] {
    return (
      ["text", "frame", "embeddable", "laser", "bucketfill"] as const
    ).filter((tool) => {
      if (this.showTextToolOutside() && tool === "text") {
        return false;
      }
      if (this.showFrameToolOutside() && tool === "frame") {
        return false;
      }
      return true;
    });
  }

  protected isExtraToolSelected() {
    return this.extraTools().includes(this.state().activeTool.type as never);
  }

  protected extraToolsIcon() {
    const activeToolType = this.state().activeTool.type;
    if (!this.isExtraToolSelected()) {
      return "dotsIcon";
    }
    switch (activeToolType) {
      case "text":
      case "image":
      case "frame":
      case "embeddable":
      case "laser":
      case "bucketfill":
        return TOOL_ICONS[activeToolType];
      default:
        return "dotsIcon";
    }
  }

  protected dropdownTools() {
    const activeToolType = this.state().activeTool.type;
    return [
      ...(this.showTextToolOutside()
        ? []
        : [
            {
              type: "text" as const,
              icon: TOOL_ICONS.text,
              shortcut: KEYS.T.toLocaleUpperCase(),
              testId: "toolbar-text",
              label: this.labels().text,
              selected: activeToolType === "text",
              disabled: this.isToolButtonDisabled("text"),
            },
          ]),
      ...(this.showImageToolOutside()
        ? []
        : [
            {
              type: "image" as const,
              icon: TOOL_ICONS.image,
              shortcut: undefined,
              testId: "toolbar-image",
              label: this.labels().image,
              selected: activeToolType === "image",
              disabled: this.isToolButtonDisabled("image"),
            },
          ]),
      ...(this.showFrameToolOutside()
        ? []
        : [
            {
              type: "frame" as const,
              icon: TOOL_ICONS.frame,
              shortcut: KEYS.F.toLocaleUpperCase(),
              testId: "toolbar-frame",
              label: this.labels().frame,
              selected: activeToolType === "frame",
              disabled: this.isToolButtonDisabled("frame"),
            },
          ]),
      {
        type: "embeddable" as const,
        icon: TOOL_ICONS.embeddable,
        shortcut: undefined,
        testId: "toolbar-embeddable",
        label: this.labels().embeddable,
        selected: activeToolType === "embeddable",
        disabled: this.isToolButtonDisabled("embeddable"),
      },
      {
        type: "autoshape" as const,
        icon: TOOL_ICONS.autoshape,
        shortcut: getToolShortcut("autoshape"),
        testId: "toolbar-autoshape",
        label: this.labels().autoshape,
        selected: activeToolType === "autoshape",
        disabled: this.isToolButtonDisabled("autoshape"),
      },
      {
        type: "laser" as const,
        icon: TOOL_ICONS.laser,
        shortcut: KEYS.K.toLocaleUpperCase(),
        testId: "toolbar-laser",
        label: this.labels().laser,
        selected: activeToolType === "laser",
        disabled: this.isToolButtonDisabled("laser"),
      },
      {
        type: "bucketfill" as const,
        icon: TOOL_ICONS.bucketfill,
        shortcut: KEYS.B.toLocaleUpperCase(),
        testId: "toolbar-bucketfill",
        label: this.labels().bucketfill,
        selected: activeToolType === "bucketfill",
        disabled: this.isToolButtonDisabled("bucketfill"),
      },
    ];
  }

  protected toggleExtraTools() {
    this.otherShapesMenuOpen.update((open) => !open);
    this.editor.setState({ openMenu: null, openPopup: null });
  }

  protected closeExtraTools() {
    this.otherShapesMenuOpen.set(false);
  }

  protected setActiveTool(type: ToolbarToolType) {
    this.editor.setActiveTool({ type });
  }

  protected onToolSelect(
    type: ToolbarToolType,
    { pointerType }: { pointerType: PointerType | null },
  ) {
    this.editor.detectPenOnToolSelect(pointerType);

    if (this.editor.state.activeTool.type !== type) {
      trackEvent("toolbar", type, "ui");
      this.editor.setActiveTool({ type });
    }
  }

  /** upstream's `app.setOpenDialog({ name: "ttd", tab: "mermaid" })`. The
   * `data-testid="toolbar-embeddable"` this entry carries is upstream's own
   * copy/paste of the embeddable item's testid — ported as-is. */
  protected openMermaidToExcalidraw() {
    this.editor.batchCommits(() =>
      this.editor.setState({ openDialog: { name: "ttd", tab: "mermaid" } }),
    );
  }
}
