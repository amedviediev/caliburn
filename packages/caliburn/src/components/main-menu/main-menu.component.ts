import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  output,
} from "@angular/core";

import { NgIcon } from "@ng-icons/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnDropdownMenuContentComponent } from "../dropdown-menu/dropdown-menu-content.component";
import { CaliburnDropdownMenuTriggerComponent } from "../dropdown-menu/dropdown-menu-trigger.component";
import { CaliburnDropdownMenuComponent } from "../dropdown-menu/dropdown-menu.component";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `main-menu/MainMenu.tsx` — the hamburger menu.
 * Upstream tunnels its content into `LayerUI`'s `.excalidraw-ui-top-left`
 * outlet and takes the menu items as children; here it is simply rendered at
 * that position and the items are projected. The `withInternalFallback` HOC
 * (which lets a host-provided `<MainMenu>` replace the built-in one) has no
 * Angular equivalent: consumers either place `caliburn-main-menu` with their
 * own items, or use `caliburn-default-main-menu`.
 *
 * The mobile collaborator `<fieldset>` is not ported — caliburn has no
 * `UserList`/collaborators surface.
 */
@Component({
  selector: "caliburn-main-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    CaliburnDropdownMenuComponent,
    CaliburnDropdownMenuContentComponent,
    CaliburnDropdownMenuTriggerComponent,
  ],
  template: `
    <caliburn-dropdown-menu [open]="state().openMenu === 'canvas'">
      <button
        caliburn-dropdown-menu-trigger
        class="main-menu-trigger"
        testId="main-menu-trigger"
        [mobile]="isMobile"
        (toggle)="onToggle()"
      >
        <ng-icon name="hamburgerMenuIcon" />
      </button>
      <caliburn-dropdown-menu-content
        class="main-menu"
        align="start"
        [mobile]="isMobile"
        (closeOutside)="closeMenu()"
        (itemSelected)="onItemSelected($event)"
      >
        <ng-content />
      </caliburn-dropdown-menu-content>
    </caliburn-dropdown-menu>
  `,
})
export class CaliburnMainMenuComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  /** called when any menu item is selected (clicked on) */
  readonly select = output<Event>();

  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  protected onToggle() {
    this.editor.batchCommits(() =>
      this.editor.setState({
        openMenu: this.editor.state.openMenu === "canvas" ? null : "canvas",
        openPopup: null,
        openDialog: null,
      }),
    );
  }

  protected closeMenu() {
    this.editor.batchCommits(() => this.editor.setState({ openMenu: null }));
  }

  protected onItemSelected(event: Event) {
    this.select.emit(event);
    this.closeMenu();
  }
}
