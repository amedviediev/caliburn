import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";

import { KEYS, capitalizeString } from "@excalidraw/common";

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

import { CaliburnDropdownMenuContentComponent } from "./dropdown-menu/dropdown-menu-content.component";
import { CaliburnDropdownMenuItemComponent } from "./dropdown-menu/dropdown-menu-item.component";
import { CaliburnDropdownMenuTriggerComponent } from "./dropdown-menu/dropdown-menu-trigger.component";
import { CaliburnDropdownMenuComponent } from "./dropdown-menu/dropdown-menu.component";
import { CaliburnHintViewerComponent } from "./hint-viewer.component";
import { CaliburnIconButtonComponent } from "./icon-button.component";
import { CaliburnIslandComponent } from "./island.component";
import { CaliburnStackRowComponent } from "./stack.component";
import { TOOL_ICONS } from "./tools";

import type { CaliburnEditorComponent } from "../editor.component";

type ToolButtonView = {
  type: ToolbarToolType;
  icon: string;
  fillable: boolean;
  title: string;
  ariaLabel: string;
  shortcut: string;
  keyBindingLabel: string | null;
  testId: string;
  checked: boolean;
  disabled: boolean;
};

/**
 * Angular port of upstream `Toolbar.tsx` — the main (desktop) toolbar
 * island. Ported for the desktop/full styles panel only: the compact
 * (tablet) tool popovers, the collab laser button and the pen-mode button
 * (which needs `togglePenMode`, not yet ported) are omitted rather than
 * stubbed. Of the dropdown's "Generate" section only the un-gated
 * mermaid-to-excalidraw entry is ported: the other two are AI surfaces
 * upstream gates on `app.props.aiEnabled` — the `TTDDialogTriggerTunnel.Out`
 * slot a Plus host fills, and `magicframe`, which additionally needs
 * `app.plugins.diagramToCode`. Neither has a caliburn equivalent.
 */
@Component({
  selector: "caliburn-toolbar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    CaliburnDropdownMenuComponent,
    CaliburnDropdownMenuContentComponent,
    CaliburnDropdownMenuItemComponent,
    CaliburnDropdownMenuTriggerComponent,
    CaliburnHintViewerComponent,
    CaliburnIconButtonComponent,
    CaliburnIslandComponent,
    CaliburnStackRowComponent,
  ],
  templateUrl: "./toolbar.component.html",
})
export class CaliburnToolbarComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  /** id of the section heading rendered inside the island (see LayerUI) */
  readonly headingId = input.required<string>();

  protected readonly labels = {
    shapes: t("headings.shapes"),
    lock: t("toolBar.lock"),
    extraTools: t("toolBar.extraTools"),
    mermaidToExcalidraw: t("toolBar.mermaidToExcalidraw"),
  };

  private readonly extraToolsMenuOpen = signal(false);
  protected readonly extraToolsOpen = this.extraToolsMenuOpen.asReadonly();

  /** the primitives take upstream's `useEditorInterface()` as an input */
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected forcedTool() {
    return this.editor.activeTool();
  }

  private isToolButtonDisabled(type: string) {
    const forcedTool = this.forcedTool();
    return forcedTool != null && forcedTool.type !== type;
  }

  private toolButton(
    type: ToolbarToolType,
    opts: { hideKeyBinding?: boolean; shortcutType?: ToolbarToolType } = {},
  ): ToolButtonView {
    const shortcutType = opts.shortcutType ?? type;
    const label = capitalizeString(t(`toolBar.${type}`));
    const shortcut = getToolShortcut(shortcutType);

    return {
      type,
      icon: TOOL_ICONS[type],
      fillable: TOOLS[type].fillable === true,
      title: `${label} — ${shortcut}`,
      ariaLabel: label,
      shortcut,
      keyBindingLabel: opts.hideKeyBinding
        ? null
        : TOOLS[shortcutType].numericKey || getToolLetter(shortcutType) || null,
      testId: `toolbar-${type}`,
      checked: this.state().activeTool.type === type,
      disabled: this.isToolButtonDisabled(type),
    };
  }

  protected buttons(): ToolButtonView[] {
    const state = this.state();
    const isLassoPreferred = state.preferredSelectionTool.type === "lasso";

    return [
      this.toolButton("hand", { hideKeyBinding: true }),
      isLassoPreferred
        ? this.toolButton("lasso", { shortcutType: "selection" })
        : this.toolButton("selection"),
      this.toolButton("rectangle"),
      this.toolButton("diamond"),
      this.toolButton("ellipse"),
      this.toolButton("arrow"),
      this.toolButton("line"),
      this.toolButton("freedraw"),
      this.toolButton("text"),
      ...(this.editor.props.UIOptions.tools?.image === false
        ? []
        : [this.toolButton("image")]),
      this.toolButton("eraser"),
    ];
  }

  protected extraTools() {
    const activeToolType = this.state().activeTool.type;

    return [
      {
        type: "frame" as const,
        icon: TOOL_ICONS.frame,
        shortcut: KEYS.F.toLocaleUpperCase(),
        testId: "toolbar-frame",
        label: t("toolBar.frame"),
        selected: activeToolType === "frame",
        disabled: this.isToolButtonDisabled("frame"),
      },
      {
        type: "embeddable" as const,
        icon: TOOL_ICONS.embeddable,
        shortcut: undefined,
        testId: "toolbar-embeddable",
        label: t("toolBar.embeddable"),
        selected: activeToolType === "embeddable",
        disabled: this.isToolButtonDisabled("embeddable"),
      },
      {
        type: "autoshape" as const,
        icon: TOOL_ICONS.autoshape,
        shortcut: getToolShortcut("autoshape"),
        testId: "toolbar-autoshape",
        label: t("toolBar.autoshape"),
        selected: activeToolType === "autoshape",
        disabled: this.isToolButtonDisabled("autoshape"),
      },
      {
        type: "laser" as const,
        icon: TOOL_ICONS.laser,
        shortcut: KEYS.K.toLocaleUpperCase(),
        testId: "toolbar-laser",
        label: t("toolBar.laser"),
        selected: activeToolType === "laser",
        disabled: this.isToolButtonDisabled("laser"),
      },
      {
        type: "bucketfill" as const,
        icon: TOOL_ICONS.bucketfill,
        shortcut: KEYS.B.toLocaleUpperCase(),
        testId: "toolbar-bucketfill",
        label: t("toolBar.bucketfill"),
        selected: activeToolType === "bucketfill",
        disabled: this.isToolButtonDisabled("bucketfill"),
      },
      {
        type: "lasso" as const,
        icon: TOOL_ICONS.lasso,
        shortcut: undefined,
        testId: "toolbar-lasso",
        label: t("toolBar.lasso"),
        selected: this.isLassoToolSelected(),
        disabled: this.isToolButtonDisabled("lasso"),
      },
    ];
  }

  private isLassoToolSelected() {
    const state = this.state();
    return (
      state.activeTool.type === "lasso" &&
      state.preferredSelectionTool.type !== "lasso"
    );
  }

  protected isExtraToolSelected() {
    const activeToolType = this.state().activeTool.type;
    return (
      activeToolType === "frame" ||
      activeToolType === "embeddable" ||
      activeToolType === "autoshape" ||
      activeToolType === "laser" ||
      activeToolType === "bucketfill" ||
      this.isLassoToolSelected()
    );
  }

  protected extraToolsIcon() {
    const activeToolType = this.state().activeTool.type;
    switch (activeToolType) {
      case "frame":
      case "embeddable":
      case "autoshape":
      case "laser":
      case "bucketfill":
        return TOOL_ICONS[activeToolType];
      default:
        return this.isLassoToolSelected() ? TOOL_ICONS.lasso : "dotsIcon";
    }
  }

  protected toggleExtraTools() {
    this.extraToolsMenuOpen.update((open) => !open);
    // upstream closes the other menus on toggle; here it doubles as the
    // synchronous change-detection pass that renders the dropdown content
    this.editor.setState({ openMenu: null, openPopup: null });
  }

  protected closeExtraTools() {
    this.extraToolsMenuOpen.set(false);
  }

  protected toggleLock() {
    this.editor.toggleToolLock();
  }

  protected setActiveTool(type: ToolbarToolType) {
    this.editor.setActiveTool({ type });
  }

  /** upstream's `app.setOpenDialog({ name: "ttd", tab: "mermaid" })`. The
   * `data-testid="toolbar-embeddable"` this entry carries is upstream's own
   * copy/paste of the embeddable item's testid — ported as-is. */
  protected openMermaidToExcalidraw() {
    this.editor.batchCommits(() =>
      this.editor.setState({ openDialog: { name: "ttd", tab: "mermaid" } }),
    );
  }

  protected onToolSelect(
    type: ToolbarToolType,
    { pointerType }: { pointerType: PointerType | null },
  ) {
    if (type === "selection") {
      if (this.editor.state.activeTool.type === "selection") {
        if (pointerType !== null) {
          // pointer-clicking the active selection tool switches to lasso;
          // keyboard/AT activation stays on selection
          this.editor.setActiveTool({ type: "lasso" });
        }
        return;
      }
      trackEvent("toolbar", "selection", "ui");
      this.editor.setActiveTool({ type: "selection" });
      return;
    }

    if (this.editor.state.activeTool.type !== type) {
      trackEvent("toolbar", type, "ui");
      this.editor.setActiveTool({ type });
    }
  }
}
