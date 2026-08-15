import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnDropdownMenuGroupComponent } from "../dropdown-menu/dropdown-menu-group.component";
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
  CaliburnMenuSocialsComponent,
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
    CaliburnDropdownMenuGroupComponent,
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
    CaliburnMenuSocialsComponent,
    CaliburnMenuToggleThemeComponent,
  ],
  templateUrl: "./default-main-menu.component.html",
})
export class CaliburnDefaultMainMenuComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly uiOptions = this.editor.props.UIOptions;
}
