import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import {
  CaliburnDropdownMenuItemComponent,
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
  CaliburnMenuPreferencesComponent,
  CaliburnMenuSaveAsImageComponent,
  CaliburnMenuSaveToActiveFileComponent,
  CaliburnMenuSearchComponent,
  CaliburnMenuSocialsComponent,
  CaliburnMenuToggleThemeComponent,
} from "../../../packages/caliburn/src/index";
import { CaliburnAppLanguageListComponent } from "../app-language/language-list.component";

import { saveDebugState } from "./debug-canvas";

/**
 * Angular port of upstream `excalidraw-app/components/AppMainMenu.tsx`.
 *
 * The Excalidraw+ item and the sign-in/sign-up item are dropped (no Plus
 * surfaces). Everything else is upstream's order, including the dev-only
 * visual debugger toggle, the app-level `ToggleTheme allowSystemTheme` and
 * the language select.
 *
 * Upstream's item carries no `data-testid`; caliburn gives it one, since both
 * harnesses that drive this menu address its items that way.
 */
@Component({
  selector: "caliburn-app-main-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnAppLanguageListComponent,
    CaliburnDropdownMenuItemComponent,
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
    CaliburnMenuPreferencesComponent,
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
  /** upstream's `refresh` prop */
  readonly refresh = output<void>();

  protected readonly isDevEnv = isDevEnv();

  protected toggleVisualDebug() {
    if (window.visualDebug) {
      delete window.visualDebug;
      saveDebugState({ enabled: false });
    } else {
      window.visualDebug = { data: [] };
      saveDebugState({ enabled: true });
    }
    this.refresh.emit();
  }
}
