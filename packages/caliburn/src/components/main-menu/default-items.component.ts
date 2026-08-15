import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
} from "@angular/core";

import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  THEME,
  applyDarkModeFilter,
  isColorDark,
} from "@excalidraw/common";

import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
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
  templateUrl: "./menu-load-scene.component.html",
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
  templateUrl: "./menu-save-to-active-file.component.html",
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
  templateUrl: "./menu-save-as-image.component.html",
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

/**
 * Upstream's library-level `DefaultMainMenu` composes every other item on this
 * page but not this one — excalidraw.com's own `AppMainMenu` adds it, right
 * before `SearchMenu`. Caliburn has no app-level menu, so
 * `caliburn-default-main-menu` takes that position for it; otherwise the
 * palette's menu trigger would have no call site at all.
 */
@Component({
  selector: "caliburn-menu-command-palette",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  templateUrl: "./menu-command-palette.component.html",
})
export class CaliburnMenuCommandPaletteComponent {
  private readonly editor = injectEditor();

  readonly extraClass = input<string>("", { alias: "class" });

  protected readonly label = t("commandPalette.title");
  protected readonly shortcut = getShortcutFromShortcutName("commandPalette");

  protected handleSelect() {
    trackEvent("command_palette", "open", "menu");
    this.editor.batchCommits(() =>
      this.editor.setState({ openDialog: { name: "commandPalette" } }),
    );
  }
}

@Component({
  selector: "caliburn-menu-search",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemComponent],
  templateUrl: "./menu-search.component.html",
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
  templateUrl: "./menu-help.component.html",
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
  templateUrl: "./menu-clear-canvas.component.html",
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
  templateUrl: "./menu-toggle-theme.component.html",
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
  templateUrl: "./menu-change-canvas-background.component.html",
})
export class CaliburnMenuChangeCanvasBackgroundComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("labels.canvasBackground");

  /** the per-swatch contract of upstream `ColorPicker/TopPicks.tsx` minus its
   * drag-and-drop classes (`is-dnd-*`), which belong to the unported
   * `useColorPickerDnD` hook */
  protected picks() {
    this.editor.changeGeneration();
    const dark = this.editor.state.theme === THEME.DARK;
    return DEFAULT_CANVAS_BACKGROUND_PICKS.map((color) => ({
      color,
      displayColor: applyDarkModeFilter(color, dark),
      isTransparent: color === "transparent" || !color,
      hasOutline: !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD),
    }));
  }

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
  templateUrl: "./menu-export.component.html",
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
  templateUrl: "./menu-live-collaboration-trigger.component.html",
})
export class CaliburnMenuLiveCollaborationTriggerComponent {
  readonly isCollaborating = input(false);

  readonly select = output<void>();

  protected readonly label = t("labels.liveCollaboration");

  protected readonly itemClass = computed(() =>
    this.isCollaborating() ? "active-collab" : "",
  );
}
