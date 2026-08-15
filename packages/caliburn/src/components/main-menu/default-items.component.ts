import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
} from "@angular/core";

import { DEFAULT_CANVAS_BACKGROUND_PICKS, THEME } from "@excalidraw/common";

import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  actionChangeViewBackgroundColor,
  actionClearCanvas,
  actionToggleTheme,
} from "../../actions/actionCanvas";
import {
  actionLoadScene,
  actionSaveToActiveFile,
} from "../../actions/actionExport";
import { actionShortcuts } from "../../actions/actionMenu";
import { actionToggleSearchMenu } from "../../actions/actionToggleSearchMenu";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnDropdownMenuItemComponent } from "../dropdown-menu/dropdown-menu-item.component";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular ports of upstream `main-menu/DefaultItems.tsx` — the composable
 * items a host (or `caliburn-default-main-menu`) drops into
 * `caliburn-main-menu`. Each renders exactly one upstream
 * `DropdownMenuItem`, keeping its classes, `data-testid`, shortcut and
 * aria-label; the wrapper custom element is `display: contents` (see
 * `styles.scss`) so the `<button>` stays a direct child of
 * `.dropdown-menu-container`.
 */
const injectEditor = () =>
  inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

@Component({
  selector: "caliburn-menu-load-scene",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    @if (enabled()) {
    <button
      caliburn-dropdown-menu-item
      icon="loadIcon"
      testId="load-button"
      [shortcut]="shortcut"
      [ariaLabel]="label"
      (select)="handleSelect()"
    >
      {{ label }}
    </button>
    }
  `,
})
export class CaliburnMenuLoadSceneComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("buttons.load");
  protected readonly shortcut = getShortcutFromShortcutName("loadScene");

  protected enabled() {
    this.editor.changeGeneration();
    return this.editor.actionManager.isActionEnabled(actionLoadScene);
  }

  protected handleSelect() {
    this.editor.actionManager.executeAction(actionLoadScene, "ui");
  }
}

@Component({
  selector: "caliburn-menu-save-to-active-file",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    @if (enabled()) {
    <button
      caliburn-dropdown-menu-item
      icon="save"
      testId="save-button"
      [shortcut]="shortcut"
      [ariaLabel]="label"
      (select)="handleSelect()"
    >
      {{ label }}
    </button>
    }
  `,
})
export class CaliburnMenuSaveToActiveFileComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("buttons.save");
  protected readonly shortcut = getShortcutFromShortcutName("saveScene");

  protected enabled() {
    this.editor.changeGeneration();
    return this.editor.actionManager.isActionEnabled(actionSaveToActiveFile);
  }

  protected handleSelect() {
    this.editor.actionManager.executeAction(actionSaveToActiveFile, "ui");
  }
}

@Component({
  selector: "caliburn-menu-save-as-image",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    <button
      caliburn-dropdown-menu-item
      icon="exportImageIcon"
      testId="image-export-button"
      [shortcut]="shortcut"
      [ariaLabel]="label"
      (select)="handleSelect()"
    >
      {{ label }}
    </button>
  `,
})
export class CaliburnMenuSaveAsImageComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("buttons.exportImage");
  protected readonly shortcut = getShortcutFromShortcutName("imageExport");

  protected handleSelect() {
    this.editor.batchCommits(() =>
      this.editor.setState({ openDialog: { name: "imageExport" } }),
    );
  }
}

@Component({
  selector: "caliburn-menu-search",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    <button
      caliburn-dropdown-menu-item
      icon="searchIcon"
      testId="search-menu-button"
      [shortcut]="shortcut"
      [ariaLabel]="label"
      [class]="extraClass()"
      (select)="handleSelect()"
    >
      {{ label }}
    </button>
  `,
})
export class CaliburnMenuSearchComponent {
  private readonly editor = injectEditor();

  readonly extraClass = input<string>("", { alias: "class" });

  protected readonly label = t("search.title");
  protected readonly shortcut = getShortcutFromShortcutName("searchMenu");

  protected handleSelect() {
    this.editor.actionManager.executeAction(actionToggleSearchMenu, "ui");
  }
}

@Component({
  selector: "caliburn-menu-help",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    <button
      caliburn-dropdown-menu-item
      icon="helpIcon"
      testId="help-menu-item"
      shortcut="?"
      [ariaLabel]="label"
      (select)="handleSelect()"
    >
      {{ label }}
    </button>
  `,
})
export class CaliburnMenuHelpComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("helpDialog.title");

  protected handleSelect() {
    this.editor.actionManager.executeAction(actionShortcuts, "ui");
  }
}

@Component({
  selector: "caliburn-menu-clear-canvas",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    @if (enabled()) {
    <button
      caliburn-dropdown-menu-item
      icon="trashIcon"
      testId="clear-canvas-button"
      [ariaLabel]="label"
      (select)="handleSelect()"
    >
      {{ label }}
    </button>
    }
  `,
})
export class CaliburnMenuClearCanvasComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("buttons.clearReset");

  protected enabled() {
    this.editor.changeGeneration();
    return this.editor.actionManager.isActionEnabled(actionClearCanvas);
  }

  protected handleSelect() {
    this.editor.activeConfirmDialog.set("clearCanvas");
  }
}

/**
 * Upstream's `allowSystemTheme` variant (a `DropdownMenuItemContentRadio` of
 * light/dark/system driven by `props.onThemeChange`) is not ported: caliburn
 * exposes no theme prop and the radio item is not among the dropdown-menu
 * primitives that landed. This is the `allowSystemTheme: false` branch, the
 * one the built-in menu uses.
 */
@Component({
  selector: "caliburn-menu-toggle-theme",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    @if (enabled()) {
    <button
      caliburn-dropdown-menu-item
      [icon]="isDark() ? 'sunIcon' : 'moonIcon'"
      testId="toggle-dark-mode"
      [shortcut]="shortcut"
      [ariaLabel]="label()"
      (select)="handleSelect($event)"
    >
      {{ label() }}
    </button>
    }
  `,
})
export class CaliburnMenuToggleThemeComponent {
  private readonly editor = injectEditor();

  protected readonly shortcut = getShortcutFromShortcutName("toggleTheme");

  protected isDark() {
    this.editor.changeGeneration();
    return this.editor.state.theme === THEME.DARK;
  }

  protected label() {
    return this.isDark() ? t("buttons.lightMode") : t("buttons.darkMode");
  }

  protected enabled() {
    this.editor.changeGeneration();
    return this.editor.actionManager.isActionEnabled(actionToggleTheme);
  }

  protected handleSelect(event: Event) {
    // do not close the menu when changing theme
    event.preventDefault();

    this.editor.actionManager.executeAction(actionToggleTheme, "ui");
  }
}

/**
 * Upstream delegates the swatches to `actionManager.renderAction(
 * "changeViewBackgroundColor")`, i.e. the full `ColorPicker` (popup, custom
 * color input, shades). Caliburn has no ColorPicker port; as in
 * `panel/shape-actions.component.ts`, the canvas-background top picks are
 * rendered directly, with the upstream classes and `color-top-pick-*` testids.
 */
@Component({
  selector: "caliburn-menu-change-canvas-background",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
    <div style="margin-top: 0.75rem">
      <div
        data-testid="canvas-background-label"
        style="font-size: 0.875rem; margin-bottom: 0.25rem; margin-left: 0.5rem"
      >
        {{ label }}
      </div>
      <div style="padding: 0 0.625rem">
        <div class="color-picker__top-picks">
          @for (color of topPicks; track color) {
          <button
            type="button"
            class="color-picker__button"
            [class.active]="color === currentColor()"
            [attr.title]="color"
            [attr.data-testid]="'color-top-pick-' + color"
            [style.--swatch-color]="color"
            (click)="setColor(color)"
          >
            <div class="color-picker__button-outline"></div>
          </button>
          }
        </div>
      </div>
    </div>
    }
  `,
})
export class CaliburnMenuChangeCanvasBackgroundComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("labels.canvasBackground");
  protected readonly topPicks = DEFAULT_CANVAS_BACKGROUND_PICKS;

  protected visible() {
    this.editor.changeGeneration();
    return (
      !this.editor.state.viewModeEnabled &&
      !!this.editor.props.UIOptions.canvasActions.changeViewBackgroundColor
    );
  }

  protected currentColor() {
    return this.editor.state.viewBackgroundColor;
  }

  protected setColor(viewBackgroundColor: string) {
    this.editor.actionManager.executeAction(
      actionChangeViewBackgroundColor,
      "ui",
      { viewBackgroundColor },
    );
  }
}

@Component({
  selector: "caliburn-menu-export",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    <button
      caliburn-dropdown-menu-item
      icon="exportIcon"
      testId="json-export-button"
      [ariaLabel]="label"
      (select)="handleSelect()"
    >
      {{ label }}
    </button>
  `,
})
export class CaliburnMenuExportComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("buttons.export");

  protected handleSelect() {
    this.editor.batchCommits(() =>
      this.editor.setState({ openDialog: { name: "jsonExport" } }),
    );
  }
}

@Component({
  selector: "caliburn-menu-live-collaboration-trigger",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  template: `
    <button
      caliburn-dropdown-menu-item
      icon="usersIcon"
      testId="collab-button"
      [class]="itemClass()"
      (select)="select.emit()"
    >
      {{ label }}
    </button>
  `,
})
export class CaliburnMenuLiveCollaborationTriggerComponent {
  readonly isCollaborating = input(false);

  readonly select = output<void>();

  protected readonly label = t("labels.liveCollaboration");

  protected readonly itemClass = computed(() =>
    this.isCollaborating() ? "active-collab" : "",
  );
}
