import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnDropdownMenuSeparatorComponent } from "../dropdown-menu/dropdown-menu-separator.component";

import {
  CaliburnMenuChangeCanvasBackgroundComponent,
  CaliburnMenuClearCanvasComponent,
  CaliburnMenuCommandPaletteComponent,
  CaliburnMenuExportComponent,
  CaliburnMenuHelpComponent,
  CaliburnMenuLoadSceneComponent,
  CaliburnMenuSaveAsImageComponent,
  CaliburnMenuSaveToActiveFileComponent,
  CaliburnMenuSearchComponent,
  CaliburnMenuToggleThemeComponent,
} from "./default-items.component";
import { CaliburnMainMenuComponent } from "./main-menu.component";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `LayerUI.tsx`'s `DefaultMainMenu` — the built-in
 * item set, rendered when the host composes no menu of its own.
 */
@Component({
  selector: "caliburn-default-main-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnDropdownMenuSeparatorComponent,
    CaliburnMainMenuComponent,
    CaliburnMenuChangeCanvasBackgroundComponent,
    CaliburnMenuClearCanvasComponent,
    CaliburnMenuCommandPaletteComponent,
    CaliburnMenuExportComponent,
    CaliburnMenuHelpComponent,
    CaliburnMenuLoadSceneComponent,
    CaliburnMenuSaveAsImageComponent,
    CaliburnMenuSaveToActiveFileComponent,
    CaliburnMenuSearchComponent,
    CaliburnMenuToggleThemeComponent,
  ],
  template: `
    <caliburn-main-menu>
      <caliburn-menu-load-scene />
      <caliburn-menu-save-to-active-file />
      @if (uiOptions.canvasActions.export) {
        <caliburn-menu-export />
      }
      @if (uiOptions.canvasActions.saveAsImage) {
        <caliburn-menu-save-as-image />
      }
      <caliburn-menu-command-palette />
      <caliburn-menu-search />
      <caliburn-menu-help />
      <caliburn-menu-clear-canvas />
      <caliburn-dropdown-menu-separator />
      <caliburn-menu-toggle-theme />
      <caliburn-menu-change-canvas-background />
    </caliburn-main-menu>
  `,
})
export class CaliburnDefaultMainMenuComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly uiOptions = this.editor.props.UIOptions;
}
