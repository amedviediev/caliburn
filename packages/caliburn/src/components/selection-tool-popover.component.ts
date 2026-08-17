import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { capitalizeString } from "@excalidraw/common";

import { TOOLS } from "@excalidraw/excalidraw/components/Tools";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ToolbarToolType } from "@excalidraw/excalidraw/components/Tools";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import { CaliburnToolPopoverComponent } from "./tool-popover.component";
import { TOOL_ICONS } from "./tools";

import type { CaliburnToolOption } from "./tool-popover.component";
import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `Tools.tsx`'s `SelectionToolPopover` — the
 * selection ⇄ lasso group used in the compact (tablet) and mobile toolbars.
 * Picking an option also makes it the preferred selection tool.
 */
@Component({
  selector: "caliburn-selection-tool-popover",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnToolPopoverComponent],
  templateUrl: "./selection-tool-popover.component.html",
})
export class CaliburnSelectionToolPopoverComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly selectionTools = translated<CaliburnToolOption[]>(() => [
    {
      type: "selection",
      icon: TOOL_ICONS.selection,
      fillable: TOOLS.selection.fillable,
      title: capitalizeString(t("toolBar.selection")),
    },
    {
      type: "lasso",
      icon: TOOL_ICONS.lasso,
      fillable: TOOLS.lasso.fillable,
      title: capitalizeString(t("toolBar.lasso")),
    },
  ]);

  protected preferredType(): ToolbarToolType {
    this.editor.changeGeneration();
    return this.editor.state.preferredSelectionTool.type;
  }

  protected displayedOption(): CaliburnToolOption {
    const tools = this.selectionTools();
    return tools.find((tool) => tool.type === this.preferredType()) ?? tools[0];
  }

  protected onToolChange(type: ToolbarToolType) {
    if (type === "selection" || type === "lasso") {
      this.editor.setActiveTool({ type });
      this.editor.setState({
        preferredSelectionTool: { type, initialized: true },
      });
    }
  }
}
