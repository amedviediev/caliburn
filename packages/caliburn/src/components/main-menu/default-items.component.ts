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
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { t } from "@excalidraw/excalidraw/i18n";

import type { Action } from "@excalidraw/excalidraw/actions/types";

import type { Theme } from "@excalidraw/element/types";

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
import { actionToggleArrowBinding } from "../../actions/actionToggleArrowBinding";
import { actionToggleGridMode } from "../../actions/actionToggleGridMode";
import { actionToggleMidpointSnapping } from "../../actions/actionToggleMidpointSnapping";
import { actionToggleObjectsSnapMode } from "../../actions/actionToggleObjectsSnapMode";
import { actionToggleSearchMenu } from "../../actions/actionToggleSearchMenu";
import { actionToggleStats } from "../../actions/actionToggleStats";
import { actionToggleViewMode } from "../../actions/actionToggleViewMode";
import { actionToggleZenMode } from "../../actions/actionToggleZenMode";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnColorPickerComponent } from "../color-picker/color-picker.component";
import { CaliburnDropdownMenuItemContentRadioComponent } from "../dropdown-menu/dropdown-menu-item-content-radio.component";
import { CaliburnDropdownMenuItemLinkComponent } from "../dropdown-menu/dropdown-menu-item-link.component";
import { CaliburnDropdownMenuItemComponent } from "../dropdown-menu/dropdown-menu-item.component";
import {
  CaliburnDropdownMenuSubComponent,
  CaliburnDropdownMenuSubContentComponent,
  CaliburnDropdownMenuSubTriggerComponent,
} from "../dropdown-menu/dropdown-menu-sub.component";
import { openConfirmModal } from "../overwrite-confirm/overwrite-confirm-state";

import type { CaliburnEditorComponent } from "../../editor.component";
import type { RadioGroupChoice } from "../radio-group.component";

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

  protected async handleSelect() {
    const elements = this.editor.scene.getNonDeletedElements();
    if (
      !elements.length ||
      (await openConfirmModal(this.editor, {
        title: t("overwriteConfirm.modal.loadFromFile.title"),
        actionLabel: t("overwriteConfirm.modal.loadFromFile.button"),
        color: "warning",
        descriptionKey: "overwriteConfirm.modal.loadFromFile.description",
      }))
    ) {
      this.editor.actionManager.executeAction(actionLoadScene, "ui");
    }
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
 * Upstream's two branches: `allowSystemTheme` renders a light/dark/system
 * `DropdownMenuItemContentRadio` driven by `props.onThemeChange` (what the
 * app's menu uses), anything else the plain toggle item the built-in menu
 * uses. `theme` is the host's own theme setting, which may be `"system"`
 * while the editor's resolved `appState.theme` is light or dark.
 */
@Component({
  selector: "caliburn-menu-toggle-theme",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnDropdownMenuItemComponent,
    CaliburnDropdownMenuItemContentRadioComponent,
  ],
  templateUrl: "./menu-toggle-theme.component.html",
})
export class CaliburnMenuToggleThemeComponent {
  private readonly editor = injectEditor();

  readonly allowSystemTheme = input(false);
  readonly theme = input<Theme | "system">(THEME.LIGHT);

  protected readonly shortcut = getShortcutFromShortcutName("toggleTheme");
  protected readonly themeLabel = t("labels.theme");
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected readonly themeChoices: RadioGroupChoice<Theme | "system">[] = [
    {
      value: THEME.LIGHT,
      icon: "sunIcon",
      ariaLabel: `${t("buttons.lightMode")} - ${this.shortcut}`,
    },
    {
      value: THEME.DARK,
      icon: "moonIcon",
      ariaLabel: `${t("buttons.darkMode")} - ${this.shortcut}`,
    },
    {
      value: "system",
      icon: "deviceDesktopIcon",
      ariaLabel: t("buttons.systemMode"),
    },
  ];

  protected setTheme(theme: Theme | "system") {
    const onThemeChange = this.editor.props.onThemeChange;
    if (onThemeChange) {
      onThemeChange(theme);
      return;
    }
    console.warn(
      "MainMenu.DefaultItems.ToggleTheme: `<caliburn-editor/> onThemeChange` must be defined to use system theme selection.",
    );
  }

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
 * Upstream delegates the picker to `actionManager.renderAction(
 * "changeViewBackgroundColor")`, whose `PanelComponent` is a `ColorPicker`
 * with `palette={null}` — top picks plus a hex input, no palette grid.
 */
@Component({
  selector: "caliburn-menu-change-canvas-background",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnColorPickerComponent],
  templateUrl: "./menu-change-canvas-background.component.html",
})
export class CaliburnMenuChangeCanvasBackgroundComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("labels.canvasBackground");
  protected readonly canvasBackgroundPicks = DEFAULT_CANVAS_BACKGROUND_PICKS;

  protected visible() {
    this.editor.changeGeneration();
    return (
      !this.editor.state.viewModeEnabled &&
      !!this.editor.props.UIOptions.canvasActions.changeViewBackgroundColor
    );
  }

  protected currentColor() {
    this.editor.changeGeneration();
    return this.editor.state.viewBackgroundColor;
  }

  /** upstream's `updateData` for this action — also how the picker drives
   * `appState.openPopup` */
  protected readonly updateViewBackgroundColor = (formData?: any) => {
    this.editor.actionManager.executeAction(
      actionChangeViewBackgroundColor,
      "ui",
      formData,
    );
  };

  protected setColor(viewBackgroundColor: string) {
    this.updateViewBackgroundColor({ viewBackgroundColor });
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

/**
 * Angular port of upstream `main-menu/DefaultItems.tsx`'s `Socials`. Upstream
 * renders three links to its own project (GitHub, X, Discord); caliburn has
 * no X or Discord presence, so those are dropped and the GitHub link points
 * at this app's own repository instead. Host-bound with `display: contents`
 * (see `styles.scss`) — upstream renders this as a fragment of sibling
 * `DropdownMenuItemLink`s, direct children of `.dropdown-menu-group`.
 */
@Component({
  selector: "caliburn-menu-socials",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDropdownMenuItemLinkComponent],
  templateUrl: "./menu-socials.component.html",
})
export class CaliburnMenuSocialsComponent {}

type PreferencesToggle = {
  id: string;
  label: string;
  shortcut?: string;
  checked: boolean;
  toggle: () => void;
};

/**
 * Angular port of upstream `main-menu/DefaultItems.tsx`'s `Preferences` and
 * the nine `Preferences*Item`s it renders. Upstream also exports each row on
 * its own (`Preferences.ToggleGridMode`, …) so a host can pass its own
 * `children` in place of the default set; caliburn renders the default set
 * from one template and keeps only the `additionalItems` half of that API —
 * anything projected into this component is appended below the nine rows.
 *
 * `DropdownMenuItemCheckbox` is not a separate component here either: upstream's
 * is a one-line wrapper that hands `DropdownMenuItem` a `checkIcon`/`emptyIcon`
 * depending on `checked`, which is exactly what the template does inline.
 *
 * Persistence is upstream's: every field these rows write lives in `appState`,
 * and the host app persists it through `clearAppStateForLocalStorage`
 * (`appState.ts`'s `APP_STATE_STORAGE_CONF`, `browser: true`). `viewModeEnabled`
 * is `browser: false` there, so — as upstream — it is the one row that does not
 * survive a reload.
 */
@Component({
  selector: "caliburn-menu-preferences",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnDropdownMenuItemComponent,
    CaliburnDropdownMenuItemContentRadioComponent,
    CaliburnDropdownMenuSubComponent,
    CaliburnDropdownMenuSubContentComponent,
    CaliburnDropdownMenuSubTriggerComponent,
  ],
  templateUrl: "./menu-preferences.component.html",
})
export class CaliburnMenuPreferencesComponent {
  private readonly editor = injectEditor();

  protected readonly label = t("labels.preferences");
  protected readonly boxSelectionLabel = t("labels.boxSelectionMode");
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected readonly boxSelectionChoices: RadioGroupChoice<
    "contain" | "overlap"
  >[] = [
    {
      value: "contain",
      label: t("labels.boxSelectionContain"),
      ariaLabel: t("labels.boxSelectionContain"),
    },
    {
      value: "overlap",
      label: t("labels.boxSelectionOverlap"),
      ariaLabel: t("labels.boxSelectionOverlap"),
    },
  ];

  protected boxSelectionMode() {
    this.editor.changeGeneration();
    return this.editor.state.boxSelectionMode;
  }

  protected setBoxSelectionMode(boxSelectionMode: "contain" | "overlap") {
    this.editor.batchCommits(() => this.editor.setState({ boxSelectionMode }));
  }

  protected toggles(): PreferencesToggle[] {
    this.editor.changeGeneration();
    const state = this.editor.state;
    const rows: PreferencesToggle[] = [
      {
        id: "tool-lock",
        label: t("labels.preferences_toolLock"),
        shortcut: getShortcutFromShortcutName("toolLock"),
        checked: state.activeTool.locked,
        toggle: () => this.editor.toggleToolLock(),
      },
      {
        id: "objects-snap-mode",
        label: t("buttons.objectsSnapMode"),
        shortcut: getShortcutFromShortcutName("objectsSnapMode"),
        checked: state.objectsSnapModeEnabled,
        toggle: () => this.execute(actionToggleObjectsSnapMode),
      },
      {
        id: "grid-mode",
        label: t("labels.toggleGrid"),
        shortcut: getShortcutFromShortcutName("gridMode"),
        checked: state.gridModeEnabled,
        toggle: () => this.execute(actionToggleGridMode),
      },
      {
        id: "zen-mode",
        label: t("buttons.zenMode"),
        shortcut: getShortcutFromShortcutName("zenMode"),
        checked: state.zenModeEnabled,
        toggle: () => this.execute(actionToggleZenMode),
      },
    ];

    if (this.editor.actionManager.isActionEnabled(actionToggleViewMode)) {
      rows.push({
        id: "view-mode",
        label: t("labels.viewMode"),
        shortcut: getShortcutFromShortcutName("viewMode"),
        checked: state.viewModeEnabled,
        toggle: () => this.execute(actionToggleViewMode),
      });
    }

    rows.push(
      {
        id: "element-properties",
        label: t("stats.fullTitle"),
        shortcut: getShortcutFromShortcutName("stats"),
        checked: state.stats.open,
        toggle: () => this.execute(actionToggleStats),
      },
      {
        id: "arrow-binding",
        label: t("labels.arrowBinding"),
        checked: state.bindingPreference === "enabled",
        toggle: () => this.execute(actionToggleArrowBinding),
      },
      {
        id: "midpoint-snapping",
        label: t("labels.midpointSnapping"),
        checked: state.isMidpointSnappingEnabled,
        toggle: () => this.execute(actionToggleMidpointSnapping),
      },
    );

    return rows;
  }

  /** upstream's rows all `preventDefault()` so the menu stays open while a
   * preference is being flipped (see `dropdown-menu-item.component.ts`) */
  protected onToggle(row: PreferencesToggle, event: Event) {
    event.preventDefault();
    row.toggle();
  }

  private execute(action: Action) {
    this.editor.actionManager.executeAction(action, "ui");
  }
}
