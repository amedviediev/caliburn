import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { CaliburnEditorComponent } from "../../src/editor.component";
import { CaliburnDropdownMenuItemComponent } from "../../src/components/dropdown-menu/dropdown-menu-item.component";
import { CaliburnFooterCenterComponent } from "../../src/components/footer-center.component";
import { CaliburnMainMenuComponent } from "../../src/components/main-menu/main-menu.component";
import { CaliburnMenuSaveAsImageComponent } from "../../src/components/main-menu/default-items.component";
import { CaliburnSidebarTriggerComponent } from "../../src/components/sidebar/sidebar-trigger.component";

/**
 * Host apps for the ported `ui` cases of upstream `interactivity.test.tsx`.
 * Upstream passes its chrome as children of `<Excalidraw>`; caliburn hands
 * the editor the templates that render it (the composition slots) and
 * projects plain children through `<ng-content>` — so the test bodies keep
 * their assertions and lose only the JSX.
 *
 * These live in a `.ts` module rather than in the `.tsx` test file because
 * only `.ts` goes through the Angular compiler in this project.
 */
@Component({
  selector: "caliburn-test-ui-child-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEditorComponent],
  template: `<caliburn-editor
    [ui]="false"
    [autoFocus]="true"
    [handleKeyboardGlobally]="true"
    [initialData]="initialData()"
  >
    <!-- children may be functional (e.g. excalidraw.com's <Collab/>),
         so they must mount even with the default UI disabled -->
    <div data-testid="host-child"></div>
  </caliburn-editor>`,
})
export class CaliburnUIChildHostComponent {
  readonly initialData = input<{
    elements?: readonly ExcalidrawElement[];
  } | null>(null);
}

@Component({
  selector: "caliburn-test-ui-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnEditorComponent,
    CaliburnDropdownMenuItemComponent,
    CaliburnFooterCenterComponent,
    CaliburnMainMenuComponent,
    CaliburnMenuSaveAsImageComponent,
    CaliburnSidebarTriggerComponent,
  ],
  template: `<caliburn-editor
    [ui]="false"
    [topLeftUI]="topLeftSlot"
    [topRightUI]="topRightSlot"
    [mainMenu]="mainMenuSlot"
    [footerCenter]="footerSlot"
  >
    <ng-template #topLeftSlot>
      <div data-testid="host-top-left"></div>
    </ng-template>
    <ng-template #topRightSlot>
      <div data-testid="host-top-right"></div>
      <button
        caliburn-sidebar-trigger
        name="default"
        title="host sidebar"
      ></button>
    </ng-template>
    <ng-template #mainMenuSlot>
      <caliburn-main-menu>
        <button caliburn-dropdown-menu-item>host menu item</button>
        <caliburn-menu-save-as-image />
      </caliburn-main-menu>
    </ng-template>
    <ng-template #footerSlot>
      <caliburn-footer-center>
        <div data-testid="host-footer"></div>
      </caliburn-footer-center>
    </ng-template>
  </caliburn-editor>`,
})
export class CaliburnUIHostComponent {}
