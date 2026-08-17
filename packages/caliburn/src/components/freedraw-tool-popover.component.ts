import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  inject,
  signal,
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

type DrawingTool = "freedraw" | "autoshape";

/**
 * Angular port of upstream `Tools.tsx`'s `FreedrawToolPopover` — the
 * freedraw ⇄ draw-shape group used in the compact (tablet) and mobile
 * toolbars. The trigger remembers and displays the most recently used option;
 * upstream keeps that in `useState` synced by an effect, mirrored here.
 */
@Component({
  selector: "caliburn-freedraw-tool-popover",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnToolPopoverComponent],
  templateUrl: "./freedraw-tool-popover.component.html",
})
export class CaliburnFreedrawToolPopoverComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly drawingTools = translated<CaliburnToolOption[]>(() => [
    {
      type: "freedraw",
      icon: TOOL_ICONS.freedraw,
      fillable: TOOLS.freedraw.fillable,
      title: capitalizeString(t("toolBar.freedraw")),
    },
    {
      type: "autoshape",
      icon: TOOL_ICONS.autoshape,
      fillable: TOOLS.autoshape.fillable,
      title: capitalizeString(t("toolBar.autoshape")),
    },
  ]);

  private readonly lastDrawingTool = signal<DrawingTool>(
    this.editor.state.activeTool.type === "autoshape"
      ? "autoshape"
      : "freedraw",
  );

  constructor() {
    effect(() => {
      this.editor.changeGeneration();
      const type = this.editor.state.activeTool.type;
      if (type === "freedraw" || type === "autoshape") {
        this.lastDrawingTool.set(type);
      }
    });
  }

  protected defaultOption(): ToolbarToolType {
    return this.lastDrawingTool();
  }

  protected displayedOption(): CaliburnToolOption {
    const tools = this.drawingTools();
    return (
      tools.find((tool) => tool.type === this.lastDrawingTool()) ?? tools[0]
    );
  }

  protected onToolChange(type: ToolbarToolType) {
    if (type === "freedraw" || type === "autoshape") {
      this.lastDrawingTool.set(type);
      this.editor.setActiveTool({ type });
    }
  }
}
