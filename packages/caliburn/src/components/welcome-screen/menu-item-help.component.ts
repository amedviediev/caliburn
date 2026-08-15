import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { actionShortcuts } from "../../actions/actionMenu";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { CaliburnWelcomeScreenMenuItemComponent } from "./menu-item.component";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `MenuItemHelp` — one of `<WelcomeScreen />`'s default center menu items.
 */
@Component({
  selector: "caliburn-welcome-screen-menu-item-help",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnWelcomeScreenMenuItemComponent],
  templateUrl: "./menu-item-help.component.html",
})
export class CaliburnWelcomeScreenMenuItemHelpComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly label = t("helpDialog.title");

  protected isMobile() {
    return this.editor.editorInterface.formFactor === "phone";
  }

  protected handleSelect() {
    this.editor.actionManager.executeAction(actionShortcuts, "ui");
  }
}
