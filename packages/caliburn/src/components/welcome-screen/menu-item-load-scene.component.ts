import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { t } from "@excalidraw/excalidraw/i18n";

import { actionLoadScene } from "../../actions/actionExport";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnWelcomeScreenMenuItemComponent } from "./menu-item.component";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `MenuItemLoadScene` — one of `<WelcomeScreen />`'s default center menu
 * items. Hidden in view mode, matching upstream's `if
 * (appState.viewModeEnabled) return null`.
 */
@Component({
  selector: "caliburn-welcome-screen-menu-item-load-scene",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnWelcomeScreenMenuItemComponent],
  templateUrl: "./menu-item-load-scene.component.html",
})
export class CaliburnWelcomeScreenMenuItemLoadSceneComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly label = t("buttons.load");
  protected readonly shortcut = getShortcutFromShortcutName("loadScene");

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected isMobile() {
    return this.editor.editorInterface.formFactor === "phone";
  }

  protected handleSelect() {
    this.editor.actionManager.executeAction(actionLoadScene, "ui");
  }
}
