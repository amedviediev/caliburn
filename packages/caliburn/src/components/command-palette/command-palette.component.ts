import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";

import {
  DEFAULT_SIDEBAR,
  EVENT,
  KEYS,
  addEventListener,
  isWritableElement,
} from "@excalidraw/common";

import { getSelectedElements } from "@excalidraw/element";

import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { distributeLibraryItemsOnSquareGrid } from "@excalidraw/excalidraw/data/library";
import { deburr } from "@excalidraw/excalidraw/deburr";
import { t } from "@excalidraw/excalidraw/i18n";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import { NgIcon } from "@ng-icons/core";

import fuzzy from "fuzzy";

import type { MarkRequired } from "@excalidraw/common/utility-types";

import type { ShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import type { Action } from "@excalidraw/excalidraw/actions/types";
import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

import {
  actionClearCanvas,
  actionToggleTheme,
} from "../../actions/actionCanvas";
import { actionToggleSearchMenu } from "../../actions/actionToggleSearchMenu";
import { actionToggleShapeSwitch } from "../../actions/actionToggleShapeSwitch";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { getActionIconName } from "../action-icons";
import { CaliburnDialogComponent } from "../dialog.component";
import { CaliburnLibraryItemIconComponent } from "../library/library-item-icon.component";
import { CaliburnTextFieldComponent } from "../text-field.component";
import { TOOL_ICONS, TOOLS, getToolLetter } from "../tools";
import {
  canChangeBackgroundColor,
  canChangeStrokeColor,
} from "../shape-action-predicates";

import { translated } from "../../i18n";

import { DEFAULT_CATEGORIES } from "./categories";

import type { OnDestroy } from "@angular/core";
import type { CaliburnEditorComponent } from "../../editor.component";
import type { ToolbarToolType } from "../tools";
import type { CommandPaletteItem } from "./types";

/**
 * Upstream keeps the last executed item in a module-level jotai atom, so it
 * outlives the palette's own mount — a module-level signal is the same scope.
 */
const lastUsedPaletteItem = signal<CommandPaletteItem | null>(null);

const getCategoryOrder = (category: string) => {
  switch (category) {
    case DEFAULT_CATEGORIES.app:
      return 1;
    case DEFAULT_CATEGORIES.export:
      return 2;
    case DEFAULT_CATEGORIES.editor:
      return 3;
    case DEFAULT_CATEGORIES.tools:
      return 4;
    case DEFAULT_CATEGORIES.elements:
      return 5;
    case DEFAULT_CATEGORIES.links:
      return 6;
    default:
      return 10;
  }
};

const isCommandPaletteToggleShortcut = (event: KeyboardEvent) => {
  return (
    !event.altKey &&
    event[KEYS.CTRL_OR_CMD] &&
    ((event.shiftKey && event.key.toLowerCase() === KEYS.P) ||
      event.key === KEYS.SLASH)
  );
};

/**
 * Angular port of upstream `CommandPalette.tsx`'s `CommandShortcutHint`. The
 * host element IS upstream's `.shortcut` div; upstream's `className` prop has
 * no call site and is not ported.
 */
@Component({
  selector: "caliburn-command-shortcut-hint",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "shortcut" },
  templateUrl: "./command-shortcut-hint.component.html",
})
export class CaliburnCommandShortcutHintComponent {
  readonly shortcut = input.required<string>();

  protected readonly keys = computed(() =>
    this.shortcut().replace("++", "+$").split("+"),
  );
}

/**
 * Angular port of upstream `CommandPalette.tsx`'s `CommandPaletteInner` — the
 * palette itself, mounted only while it is open, as upstream mounts it.
 *
 * Upstream builds `allCommands` in a mount effect over `useStable` deps, so
 * the list is fixed for the lifetime of one opening; the constructor here is
 * that same moment. The category list is likewise recomputed only from the
 * inputs upstream's effect depends on (the query, the built commands and the
 * recent item), not from every appState change.
 *
 * Upstream's `customCommandPaletteItems` prop is the editor's input of the
 * same name; its `defaultItems` static (upstream's
 * `defaultCommandPaletteItems.ts` is an empty module) is not ported.
 */
@Component({
  selector: "caliburn-command-palette-inner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnCommandShortcutHintComponent,
    CaliburnDialogComponent,
    CaliburnLibraryItemIconComponent,
    CaliburnTextFieldComponent,
    NgIcon,
    NgTemplateOutlet,
  ],
  templateUrl: "./command-palette-inner.component.html",
})
export class CaliburnCommandPaletteInnerComponent implements OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly isPhone = computed(
    () => this.editor.editorInterface.formFactor === "phone",
  );
  protected readonly placeholder = translated(() =>
    t("commandPalette.search.placeholder"),
  );
  protected readonly noMatchLabel = translated(() =>
    t("commandPalette.search.noMatch"),
  );
  protected readonly recentsLabel = translated(() =>
    t("commandPalette.recents"),
  );
  protected readonly selectLabel = translated(() =>
    t("commandPalette.shortcuts.select"),
  );
  protected readonly confirmLabel = translated(() =>
    t("commandPalette.shortcuts.confirm"),
  );
  protected readonly closeLabel = translated(() =>
    t("commandPalette.shortcuts.close"),
  );
  protected readonly itemNotAvailableLabel = translated(() =>
    t("commandPalette.itemNotAvailable"),
  );
  protected readonly escapeShortcut = getShortcutKey("Esc");

  protected readonly lastUsed = lastUsedPaletteItem;
  protected readonly commandSearch = signal("");
  protected readonly currentCommand = signal<CommandPaletteItem | null>(null);
  protected readonly commandsByCategory = signal<
    Record<string, CommandPaletteItem[]>
  >({});
  protected readonly categories = signal<string[]>([]);

  private allCommands: MarkRequired<
    CommandPaletteItem,
    "haystack" | "order"
  >[] = [];

  /** upstream's `libraryCommands` — one command per *named* library item,
   * only ever offered while the user is searching */
  private readonly libraryCommands = computed<CommandPaletteItem[]>(() =>
    this.editor
      .libraryItemsData()
      .libraryItems.filter((libraryItem) => !!libraryItem.name)
      .map((libraryItem) => ({
        label: libraryItem.name!,
        libraryItem: { id: libraryItem.id, elements: libraryItem.elements },
        category: DEFAULT_CATEGORIES.library,
        order: getCategoryOrder(DEFAULT_CATEGORIES.library),
        haystack: deburr(libraryItem.name!),
        perform: () => {
          this.editor.onInsertElements(
            distributeLibraryItemsOnSquareGrid([libraryItem]),
          );
        },
      })),
  );

  private readonly detachKeyDown = addEventListener(
    window,
    EVENT.KEYDOWN,
    (event: Event) => this.handleKeyDown(event as KeyboardEvent),
    { capture: true, passive: false },
  );

  constructor() {
    this.buildCommands();
  }

  ngOnDestroy() {
    this.detachKeyDown();
  }

  protected handleSearchChange(value: string) {
    this.commandSearch.set(value);
    this.applyCommands();
    this.cdr.detectChanges();
  }

  protected onItemClick(
    command: CommandPaletteItem,
    disabled: boolean | undefined,
    event: MouseEvent,
  ) {
    if (!disabled) {
      this.executeCommand(command, event);
    }
  }

  protected onItemMouseMove(
    command: CommandPaletteItem,
    disabled: boolean | undefined,
  ) {
    if (!disabled) {
      this.currentCommand.set(command);
    }
  }

  protected closeCommandPalette(cb?: () => void) {
    this.editor.batchCommits(() =>
      this.editor.setState({ openDialog: null }, cb),
    );
    this.commandSearch.set("");
  }

  protected isCommandAvailable(command: CommandPaletteItem) {
    if (command.viewMode === false && this.editor.state.viewModeEnabled) {
      return false;
    }

    return typeof command.predicate === "function"
      ? command.predicate(
          this.editor.scene.getNonDeletedElements(),
          this.editor.state,
          this.editor.props as any,
          this.editor as any,
        )
      : command.predicate === undefined || command.predicate;
  }

  private executeCommand(
    command: CommandPaletteItem,
    event: MouseEvent | KeyboardEvent,
  ) {
    if (this.editor.state.openDialog?.name !== "commandPalette") {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    document.body.classList.add("excalidraw-animations-disabled");
    this.closeCommandPalette(() => {
      command.perform({ actionManager: this.editor.actionManager, event });
      lastUsedPaletteItem.set(command);

      requestAnimationFrame(() => {
        document.body.classList.remove("excalidraw-animations-disabled");
      });
    });
  }

  private handleKeyDown(event: KeyboardEvent) {
    const ignoreAlphanumerics =
      isWritableElement(event.target) ||
      isCommandPaletteToggleShortcut(event) ||
      event.key === KEYS.ESCAPE;

    if (
      ignoreAlphanumerics &&
      event.key !== KEYS.ARROW_UP &&
      event.key !== KEYS.ARROW_DOWN &&
      event.key !== KEYS.ENTER
    ) {
      return;
    }

    const matchingCommands = Object.values(this.commandsByCategory()).flat();
    const lastUsed = this.lastUsed();
    const currentCommand = this.currentCommand();
    const shouldConsiderLastUsed =
      lastUsed && !this.commandSearch() && this.isCommandAvailable(lastUsed);

    if (event.key === KEYS.ARROW_UP) {
      event.preventDefault();
      const index = matchingCommands.findIndex(
        (item) => item.label === currentCommand?.label,
      );

      if (shouldConsiderLastUsed) {
        if (index === 0) {
          this.selectCommand(lastUsed);
          return;
        }

        if (currentCommand === lastUsed) {
          const nextItem = matchingCommands[matchingCommands.length - 1];
          if (nextItem) {
            this.selectCommand(nextItem);
          }
          return;
        }
      }

      let nextIndex;

      if (index === -1) {
        nextIndex = matchingCommands.length - 1;
      } else {
        nextIndex =
          index === 0
            ? matchingCommands.length - 1
            : (index - 1) % matchingCommands.length;
      }

      const nextItem = matchingCommands[nextIndex];
      if (nextItem) {
        this.selectCommand(nextItem);
      }

      return;
    }

    if (event.key === KEYS.ARROW_DOWN) {
      event.preventDefault();
      const index = matchingCommands.findIndex(
        (item) => item.label === currentCommand?.label,
      );

      if (shouldConsiderLastUsed) {
        if (!currentCommand || index === matchingCommands.length - 1) {
          this.selectCommand(lastUsed);
          return;
        }

        if (currentCommand === lastUsed) {
          const nextItem = matchingCommands[0];
          if (nextItem) {
            this.selectCommand(nextItem);
          }
          return;
        }
      }

      const nextIndex = (index + 1) % matchingCommands.length;
      const nextItem = matchingCommands[nextIndex];
      if (nextItem) {
        this.selectCommand(nextItem);
      }

      return;
    }

    if (event.key === KEYS.ENTER) {
      if (currentCommand) {
        setTimeout(() => {
          this.executeCommand(currentCommand, event);
        });
      }
    }

    if (ignoreAlphanumerics) {
      return;
    }

    // prevent regular editor shortcuts
    event.stopPropagation();

    // if alphanumeric keypress and we're not inside the input, focus it
    if (/^[a-zA-Z0-9]$/.test(event.key)) {
      this.focusInput();
      return;
    }

    event.preventDefault();
  }

  /**
   * Upstream re-renders on the `currentCommand` state change and scrolls the
   * highlighted row into view from its ref callback; Angular has no per-render
   * ref hook, so the pass is forced here and the row looked up after it.
   */
  private selectCommand(command: CommandPaletteItem) {
    this.currentCommand.set(command);
    this.cdr.detectChanges();
    this.editor.excalidrawContainerValue.container
      ?.querySelector(".command-item.item-selected:not(.item-disabled)")
      ?.scrollIntoView?.({ block: "nearest" });
  }

  private focusInput() {
    this.editor.excalidrawContainerValue.container
      ?.querySelector<HTMLInputElement>(".command-palette-dialog input")
      ?.focus();
  }

  private buildCommands() {
    const app = this.editor;
    const appState = app.state;
    const elements = app.scene.getNonDeletedElements();
    const actionManager = app.actionManager;

    const getActionLabel = (action: Action) => {
      let label = "";
      if (action.label) {
        if (typeof action.label === "function") {
          label = t(
            action.label(
              elements,
              appState,
              app as any,
            ) as unknown as TranslationKeys,
          );
        } else {
          label = t(action.label as unknown as TranslationKeys);
        }
      }
      return label;
    };

    const actionToCommand = (
      action: Action,
      category: string,
      transformer?: (
        command: CommandPaletteItem,
        action: Action,
      ) => CommandPaletteItem,
    ): CommandPaletteItem => {
      const command: CommandPaletteItem = {
        label: getActionLabel(action),
        icon: getActionIconName(action, appState, elements),
        category,
        shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
        keywords: action.keywords,
        predicate: action.predicate,
        viewMode: action.viewMode,
        perform: () => {
          actionManager.executeAction(action, "commandPalette");
        },
      };

      return transformer ? transformer(command, action) : command;
    };

    const elementsCommands: CommandPaletteItem[] = [
      actionManager.actions.group,
      actionManager.actions.ungroup,
      actionManager.actions.cut,
      actionManager.actions.copy,
      actionManager.actions.deleteSelectedElements,
      actionManager.actions.wrapSelectionInFrame,
      actionManager.actions.copyStyles,
      actionManager.actions.pasteStyles,
      actionManager.actions.bringToFront,
      actionManager.actions.bringForward,
      actionManager.actions.sendBackward,
      actionManager.actions.sendToBack,
      actionManager.actions.alignTop,
      actionManager.actions.alignBottom,
      actionManager.actions.alignLeft,
      actionManager.actions.alignRight,
      actionManager.actions.alignVerticallyCentered,
      actionManager.actions.alignHorizontallyCentered,
      actionManager.actions.duplicateSelection,
      actionManager.actions.flipHorizontal,
      actionManager.actions.flipVertical,
      actionManager.actions.zoomToFitSelection,
      actionManager.actions.zoomToFitSelectionInViewport,
      actionManager.actions.increaseFontSize,
      actionManager.actions.decreaseFontSize,
      actionManager.actions.toggleLinearEditor,
      actionManager.actions.cropEditor,
      actionManager.actions.togglePolygon,
      actionManager.actions.hyperlink,
      actionManager.actions.copyElementLink,
      actionManager.actions.linkToElement,
    ].map((action: Action) =>
      actionToCommand(
        action,
        DEFAULT_CATEGORIES.elements,
        (command, action) => ({
          ...command,
          predicate: action.predicate
            ? action.predicate
            : (elements, appState) =>
                getSelectedElements(elements, appState).length > 0,
        }),
      ),
    );

    const editorCommands: CommandPaletteItem[] = [
      actionManager.actions.undo,
      actionManager.actions.redo,
      actionManager.actions.zoomIn,
      actionManager.actions.zoomOut,
      actionManager.actions.resetZoom,
      actionManager.actions.zoomToFit,
      actionManager.actions.zenMode,
      actionManager.actions.viewMode,
      actionManager.actions.gridMode,
      actionManager.actions.objectsSnapMode,
      actionManager.actions.toggleShortcuts,
      actionManager.actions.selectAll,
      actionManager.actions.toggleElementLock,
      actionManager.actions.unlockAllElements,
      actionManager.actions.stats,
    ].map((action) => actionToCommand(action, DEFAULT_CATEGORIES.editor));

    const exportCommands: CommandPaletteItem[] = [
      actionManager.actions.saveToActiveFile,
      actionManager.actions.saveFileToDisk,
      actionManager.actions.copyAsPng,
      actionManager.actions.copyAsSvg,
    ].map((action) => actionToCommand(action, DEFAULT_CATEGORIES.export));

    const commandsFromActions: CommandPaletteItem[] = [
      ...elementsCommands,
      ...editorCommands,
      {
        label: getActionLabel(actionClearCanvas),
        icon: getActionIconName(actionClearCanvas, appState, elements),
        shortcut: getShortcutFromShortcutName(
          actionClearCanvas.name as ShortcutName,
        ),
        category: DEFAULT_CATEGORIES.editor,
        keywords: ["delete", "destroy"],
        viewMode: false,
        perform: () => {
          app.activeConfirmDialog.set("clearCanvas");
        },
      },
      {
        label: t("buttons.exportImage"),
        category: DEFAULT_CATEGORIES.export,
        icon: "exportImageIcon",
        shortcut: getShortcutFromShortcutName("imageExport"),
        keywords: [
          "export",
          "image",
          "png",
          "jpeg",
          "svg",
          "clipboard",
          "picture",
        ],
        perform: () => {
          app.batchCommits(() =>
            app.setState({ openDialog: { name: "imageExport" } }),
          );
        },
      },
      ...exportCommands,
    ];

    const additionalCommands: CommandPaletteItem[] = [
      actionToCommand(actionToggleTheme, DEFAULT_CATEGORIES.app),
      {
        label: t("toolBar.library"),
        category: DEFAULT_CATEGORIES.app,
        icon: "libraryIcon",
        viewMode: false,
        perform: () => {
          app.batchCommits(() =>
            app.setState((state) => ({
              openSidebar: state.openSidebar
                ? null
                : {
                    name: DEFAULT_SIDEBAR.name,
                    tab: DEFAULT_SIDEBAR.defaultTab,
                  },
            })),
          );
        },
      },
      {
        label: t("search.title"),
        category: DEFAULT_CATEGORIES.app,
        icon: "searchIcon",
        viewMode: true,
        perform: () => {
          actionManager.executeAction(actionToggleSearchMenu);
        },
      },
      {
        label: t("labels.shapeSwitch"),
        category: DEFAULT_CATEGORIES.elements,
        icon: "boltIcon",
        perform: () => {
          actionManager.executeAction(actionToggleShapeSwitch);
        },
      },
      {
        label: t("labels.changeStroke"),
        keywords: ["color", "outline"],
        category: DEFAULT_CATEGORIES.elements,
        icon: "bucketFillIcon",
        viewMode: false,
        predicate: (elements, appState) => {
          const selectedElements = getSelectedElements(elements, appState);
          return (
            selectedElements.length > 0 &&
            canChangeStrokeColor(appState, selectedElements)
          );
        },
        perform: () => {
          app.batchCommits(() => app.setState({ openPopup: "elementStroke" }));
        },
      },
      {
        label: t("labels.changeBackground"),
        keywords: ["color", "fill"],
        icon: "bucketFillIcon",
        category: DEFAULT_CATEGORIES.elements,
        viewMode: false,
        predicate: (elements, appState) => {
          const selectedElements = getSelectedElements(elements, appState);
          return (
            selectedElements.length > 0 &&
            canChangeBackgroundColor(appState, selectedElements)
          );
        },
        perform: () => {
          app.batchCommits(() =>
            app.setState({ openPopup: "elementBackground" }),
          );
        },
      },
      {
        label: t("labels.canvasBackground"),
        keywords: ["color"],
        icon: "bucketFillIcon",
        category: DEFAULT_CATEGORIES.editor,
        viewMode: false,
        perform: () => {
          app.batchCommits(() =>
            app.setState((prevState) => ({
              openMenu: prevState.openMenu === "canvas" ? null : "canvas",
              openPopup: "canvasBackground",
            })),
          );
        },
      },
      ...(Object.keys(TOOLS) as ToolbarToolType[]).reduce(
        (acc: CommandPaletteItem[], value) => {
          // upstream tests `UIOptions.tools` here; caliburn's `isToolSupported`
          // is that check plus the non-interactive editor's own tool gate
          if (!app.isToolSupported(value)) {
            return acc;
          }

          const config = TOOLS[value];
          const shortcut = getToolLetter(value) || config.numericKey;

          acc.push({
            label: t(`toolBar.${value}`),
            category: DEFAULT_CATEGORIES.tools,
            shortcut,
            icon: TOOL_ICONS[value],
            keywords: ["toolbar"],
            viewMode: false,
            perform: () => {
              app.setActiveTool({ type: value }, { toggle: false });
            },
          });

          return acc;
        },
        [],
      ),
      {
        label: t("toolBar.lock"),
        category: DEFAULT_CATEGORIES.tools,
        icon: appState.activeTool.locked ? "lockedIcon" : "unlockedIcon",
        shortcut: KEYS.Q.toLocaleUpperCase(),
        viewMode: false,
        perform: () => {
          app.toggleToolLock();
        },
      },
      // upstream's neighbouring `labels.textToDiagram` entry is the AI half
      // of the same dialog and stays out. Both carry `predicate:
      // appProps.aiEnabled`, which `index.tsx` resolves as `aiEnabled !==
      // false` — i.e. enabled unless a host opts out. Caliburn exposes no
      // `aiEnabled` prop at all, so the mermaid entry is registered
      // unconditionally, matching upstream's default.
      {
        label: `${t("toolBar.mermaidToExcalidraw")}...`,
        category: DEFAULT_CATEGORIES.tools,
        icon: "mermaidLogoIcon",
        viewMode: false,
        perform: () => {
          app.setState({ openDialog: { name: "ttd", tab: "mermaid" } });
        },
      },
    ];

    this.allCommands = [
      ...commandsFromActions,
      ...additionalCommands,
      ...this.editor.customCommandPaletteItems(),
    ].map((command) => ({
      ...command,
      icon: command.icon || "boltIcon",
      order: command.order ?? getCategoryOrder(command.category),
      haystack: `${deburr(command.label.toLocaleLowerCase())} ${
        command.keywords?.join(" ") || ""
      }`,
    }));

    const lastUsed = this.lastUsed();
    lastUsedPaletteItem.set(
      [...this.allCommands, ...this.libraryCommands()].find(
        (command) => command.label === lastUsed?.label,
      ) ?? null,
    );

    this.applyCommands();
  }

  private applyCommands() {
    const getNextCommandsByCategory = (commands: CommandPaletteItem[]) => {
      const nextCommandsByCategory: Record<string, CommandPaletteItem[]> = {};
      for (const command of commands) {
        if (nextCommandsByCategory[command.category]) {
          nextCommandsByCategory[command.category].push(command);
        } else {
          nextCommandsByCategory[command.category] = [command];
        }
      }

      return nextCommandsByCategory;
    };

    const setCommands = (commands: Record<string, CommandPaletteItem[]>) => {
      this.commandsByCategory.set(commands);
      this.categories.set(Object.keys(commands));
    };

    const commandSearch = this.commandSearch();
    const lastUsed = this.lastUsed();
    let matchingCommands =
      commandSearch?.length > 1
        ? [
            ...this.allCommands
              .filter((command) => this.isCommandAvailable(command))
              .sort((a, b) => a.order - b.order),
            ...this.libraryCommands(),
          ]
        : this.allCommands
            .filter((command) => this.isCommandAvailable(command))
            .sort((a, b) => a.order - b.order);

    const showLastUsed =
      !commandSearch && lastUsed && this.isCommandAvailable(lastUsed);

    if (!commandSearch) {
      setCommands(
        getNextCommandsByCategory(
          showLastUsed
            ? matchingCommands.filter(
                (command) => command.label !== lastUsed?.label,
              )
            : matchingCommands,
        ),
      );
      this.currentCommand.set(
        showLastUsed ? lastUsed : matchingCommands[0] || null,
      );
      return;
    }

    const query = deburr(
      commandSearch.toLocaleLowerCase().replace(/[<>_| -]/g, ""),
    );
    matchingCommands = fuzzy
      .filter(query, matchingCommands, {
        extract: (command) => command.haystack ?? "",
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.original);

    setCommands(getNextCommandsByCategory(matchingCommands));
    this.currentCommand.set(matchingCommands[0] ?? null);
  }
}

/**
 * Angular port of upstream `CommandPalette.tsx`'s outer component: always
 * mounted, owns the CtrlOrCmd+/ (and CtrlOrCmd+Shift+P) toggle, and renders
 * the palette only while `appState.openDialog` is `{ name: "commandPalette" }`.
 */
@Component({
  selector: "caliburn-command-palette",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnCommandPaletteInnerComponent],
  templateUrl: "./command-palette.component.html",
})
export class CaliburnCommandPaletteComponent implements OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private readonly detachToggle = addEventListener(
    window,
    EVENT.KEYDOWN,
    (event: Event) => this.handleToggleShortcut(event as KeyboardEvent),
    { capture: true, passive: false },
  );

  ngOnDestroy() {
    this.detachToggle();
  }

  protected isOpen() {
    this.editor.changeGeneration();
    return this.editor.state.openDialog?.name === "commandPalette";
  }

  private handleToggleShortcut(event: KeyboardEvent) {
    if (!isCommandPaletteToggleShortcut(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.editor.batchCommits(() =>
      this.editor.setState((appState) => {
        const nextState =
          appState.openDialog?.name === "commandPalette"
            ? null
            : ({ name: "commandPalette" } as const);

        if (nextState) {
          trackEvent("command_palette", "open", "shortcut");
        }

        return { openDialog: nextState };
      }),
    );
  }
}
