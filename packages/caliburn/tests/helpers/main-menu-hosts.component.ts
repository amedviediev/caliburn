import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { UIOptions } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent } from "../../src/editor.component";
import { CaliburnDropdownMenuItemCustomComponent } from "../../src/components/dropdown-menu/dropdown-menu-item-custom.component";
import { CaliburnDropdownMenuItemLinkComponent } from "../../src/components/dropdown-menu/dropdown-menu-item-link.component";
import { CaliburnDropdownMenuItemComponent } from "../../src/components/dropdown-menu/dropdown-menu-item.component";
import { CaliburnFooterCenterComponent } from "../../src/components/footer-center.component";
import {
  CaliburnMenuChangeCanvasBackgroundComponent,
  CaliburnMenuCommandPaletteComponent,
  CaliburnMenuHelpComponent,
  CaliburnMenuLoadSceneComponent,
  CaliburnMenuToggleThemeComponent,
} from "../../src/components/main-menu/default-items.component";
import { CaliburnMainMenuComponent } from "../../src/components/main-menu/main-menu.component";

/**
 * Host apps for the ported `<Excalidraw/>` prop suite. Upstream passes its
 * `<Footer>` / `<MainMenu>` as children of `<Excalidraw>`; caliburn hands the
 * editor the template that renders them (the `footerCenter` / `mainMenu`
 * slots) and projects plain children through `<ng-content>`, so the test
 * bodies keep their assertions and lose only the JSX.
 *
 * These live in a `.ts` module rather than in the `.tsx` test file because
 * only `.ts` goes through the Angular compiler in this project.
 */
@Component({
  selector: "caliburn-test-plain-child-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEditorComponent],
  template: `<caliburn-editor>
    <div>This is a custom footer</div>
  </caliburn-editor>`,
})
export class CaliburnPlainChildHostComponent {}

@Component({
  selector: "caliburn-test-footer-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEditorComponent, CaliburnFooterCenterComponent],
  template: `<caliburn-editor [footerCenter]="footerSlot">
    <ng-template #footerSlot>
      <caliburn-footer-center>
        <div>This is a custom footer</div>
      </caliburn-footer-center>
    </ng-template>
  </caliburn-editor>`,
})
export class CaliburnFooterHostComponent {}

@Component({
  selector: "caliburn-test-canvas-background-menu-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnEditorComponent,
    CaliburnMainMenuComponent,
    CaliburnMenuChangeCanvasBackgroundComponent,
  ],
  template: `<caliburn-editor
    [UIOptions]="UIOptions()"
    [mainMenu]="mainMenuSlot"
  >
    <ng-template #mainMenuSlot>
      <caliburn-main-menu>
        <caliburn-menu-change-canvas-background />
      </caliburn-main-menu>
    </ng-template>
  </caliburn-editor>`,
})
export class CaliburnCanvasBackgroundMenuHostComponent {
  readonly UIOptions = input<Partial<UIOptions> | undefined>(undefined);
}

@Component({
  selector: "caliburn-test-load-scene-menu-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnEditorComponent,
    CaliburnDropdownMenuItemCustomComponent,
    CaliburnMainMenuComponent,
    CaliburnMenuLoadSceneComponent,
  ],
  template: `<caliburn-editor
    [UIOptions]="UIOptions()"
    [mainMenu]="mainMenuSlot"
  >
    <ng-template #mainMenuSlot>
      <caliburn-main-menu>
        <caliburn-dropdown-menu-item-custom>
          <button style="height: 2rem" (click)="alertCustom()">
            custom item
          </button>
        </caliburn-dropdown-menu-item-custom>
        <caliburn-menu-load-scene />
      </caliburn-main-menu>
    </ng-template>
  </caliburn-editor>`,
})
export class CaliburnLoadSceneMenuHostComponent {
  readonly UIOptions = input<Partial<UIOptions> | undefined>(undefined);

  protected alertCustom() {
    window.alert("custom menu item");
  }
}

@Component({
  selector: "caliburn-test-host-menu-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnEditorComponent,
    CaliburnDropdownMenuItemComponent,
    CaliburnDropdownMenuItemCustomComponent,
    CaliburnDropdownMenuItemLinkComponent,
    CaliburnMainMenuComponent,
    CaliburnMenuHelpComponent,
  ],
  template: `<caliburn-editor [mainMenu]="mainMenuSlot">
    <ng-template #mainMenuSlot>
      <caliburn-main-menu>
        <button caliburn-dropdown-menu-item (select)="alertClicked()">
          Click me
        </button>
        <a caliburn-dropdown-menu-item-link href="blog.excalidaw.com">
          Excalidraw blog
        </a>
        <caliburn-dropdown-menu-item-custom>
          <button style="height: 2rem" (click)="alertCustom()">
            custom menu item
          </button>
        </caliburn-dropdown-menu-item-custom>
        <caliburn-menu-help />
      </caliburn-main-menu>
    </ng-template>
  </caliburn-editor>`,
})
export class CaliburnHostMenuHostComponent {
  protected alertClicked() {
    window.alert("Clicked");
  }

  protected alertCustom() {
    window.alert("custom menu item");
  }
}

/**
 * The command-palette item is not part of the built-in menu (upstream's
 * `DefaultMainMenu` has none either) — a host composes it, as caliburn-app
 * does. This host stands in for that app menu in `commandPalette.test.tsx`.
 */
@Component({
  selector: "caliburn-test-command-palette-menu-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnEditorComponent,
    CaliburnMainMenuComponent,
    CaliburnMenuCommandPaletteComponent,
  ],
  template: `<caliburn-editor
    [handleKeyboardGlobally]="true"
    [mainMenu]="mainMenuSlot"
  >
    <ng-template #mainMenuSlot>
      <caliburn-main-menu>
        <caliburn-menu-command-palette />
      </caliburn-main-menu>
    </ng-template>
  </caliburn-editor>`,
})
export class CaliburnCommandPaletteMenuHostComponent {}

@Component({
  selector: "caliburn-test-theme-toggle-menu-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnEditorComponent,
    CaliburnMainMenuComponent,
    CaliburnMenuToggleThemeComponent,
  ],
  template: `<caliburn-editor [mainMenu]="mainMenuSlot">
    <ng-template #mainMenuSlot>
      <caliburn-main-menu>
        <caliburn-menu-toggle-theme [allowSystemTheme]="false" />
      </caliburn-main-menu>
    </ng-template>
  </caliburn-editor>`,
})
export class CaliburnThemeToggleMenuHostComponent {}
