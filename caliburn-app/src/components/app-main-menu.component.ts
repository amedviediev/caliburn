import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

import type { Theme } from "@excalidraw/element/types";

import {
  CaliburnDropdownMenuItemCustomComponent,
  CaliburnDropdownMenuSeparatorComponent,
  CaliburnMainMenuComponent,
  CaliburnMenuChangeCanvasBackgroundComponent,
  CaliburnMenuClearCanvasComponent,
  CaliburnMenuCommandPaletteComponent,
  CaliburnMenuExportComponent,
  CaliburnMenuHelpComponent,
  CaliburnMenuLiveCollaborationTriggerComponent,
  CaliburnMenuLoadSceneComponent,
  CaliburnMenuSaveAsImageComponent,
  CaliburnMenuSaveToActiveFileComponent,
  CaliburnMenuSearchComponent,
  CaliburnMenuSocialsComponent,
  CaliburnMenuToggleThemeComponent,
} from "../../../packages/caliburn/src/index";
import { CaliburnAppLanguageListComponent } from "../app-language/language-list.component";

/**
 * Angular port of upstream `excalidraw-app/components/AppMainMenu.tsx`.
 *
 * The Excalidraw+ item, the sign-in/sign-up item and the dev-only visual
 * debugger item are dropped (no Plus surfaces, no debug canvas); the
 * `Preferences` item has no caliburn equivalent yet. Everything else is
 * upstream's order, including the app-level `ToggleTheme allowSystemTheme`
 * and the language select.
 */
@Component({
  selector: "caliburn-app-main-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnAppLanguageListComponent,
    CaliburnDropdownMenuItemCustomComponent,
    CaliburnDropdownMenuSeparatorComponent,
    CaliburnMainMenuComponent,
    CaliburnMenuChangeCanvasBackgroundComponent,
    CaliburnMenuClearCanvasComponent,
    CaliburnMenuCommandPaletteComponent,
    CaliburnMenuExportComponent,
    CaliburnMenuHelpComponent,
    CaliburnMenuLiveCollaborationTriggerComponent,
    CaliburnMenuLoadSceneComponent,
    CaliburnMenuSaveAsImageComponent,
    CaliburnMenuSaveToActiveFileComponent,
    CaliburnMenuSearchComponent,
    CaliburnMenuSocialsComponent,
    CaliburnMenuToggleThemeComponent,
  ],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./app-main-menu.component.html",
})
export class CaliburnAppMainMenuComponent {
  readonly isCollaborating = input(false);
  readonly isCollabEnabled = input(false);
  readonly theme = input.required<Theme | "system">();

  readonly collabDialogOpen = output<void>();
}
