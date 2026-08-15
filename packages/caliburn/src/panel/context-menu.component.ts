import { Component, forwardRef, inject } from "@angular/core";

import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import type { Action } from "@excalidraw/excalidraw/actions/types";
import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

import { CONTEXT_MENU_SEPARATOR } from "../context-menu-interaction";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import type { ContextMenuItem } from "../context-menu-interaction";
import type { CaliburnEditorComponent } from "../editor.component";

interface RenderedItem {
  separator: boolean;
  action: Action | null;
  label: string;
  shortcut: string;
  dangerous: boolean;
  checked: boolean;
}

/**
 * The Angular port of upstream `ContextMenu.tsx`: renders
 * `appState.contextMenu` with the same DOM contract
 * (.context-menu list, li[data-testid=<action name>],
 * .context-menu-item__label).
 */
@Component({
  selector: "caliburn-context-menu",
  templateUrl: "./context-menu.component.html",
})
export class CaliburnContextMenuComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  menu() {
    this.host.changeGeneration();
    return this.host.state.contextMenu as {
      top: number;
      left: number;
      items: ContextMenuItem[];
    } | null;
  }

  items(): RenderedItem[] {
    const menu = this.menu();
    if (!menu) {
      return [];
    }
    const editor = this.host;
    const elements = editor.scene.getElementsIncludingDeleted();

    const filtered = menu.items.filter(
      (item) =>
        item &&
        (item === CONTEXT_MENU_SEPARATOR ||
          !item.predicate ||
          item.predicate(
            elements,
            editor.state,
            editor.props as any,
            editor as any,
          )),
    );

    const rendered: RenderedItem[] = [];
    for (const item of filtered) {
      if (item === CONTEXT_MENU_SEPARATOR) {
        const prev = rendered[rendered.length - 1];
        if (!prev || prev.separator) {
          continue;
        }
        rendered.push({
          separator: true,
          action: null,
          label: "",
          shortcut: "",
          dangerous: false,
          checked: false,
        });
        continue;
      }

      let label = "";
      if (item.label) {
        if (typeof item.label === "function") {
          label = t(
            item.label(
              elements,
              editor.state,
              editor as any,
            ) as unknown as TranslationKeys,
          );
        } else {
          label = t(item.label as unknown as TranslationKeys);
        }
      }

      rendered.push({
        separator: false,
        action: item,
        label,
        shortcut: item.name
          ? getShortcutFromShortcutName(item.name as ShortcutName)
          : "",
        dangerous: item.name === "deleteSelectedElements",
        checked: !!item.checked?.(editor.state),
      });
    }

    return rendered;
  }

  executeItem(action: Action) {
    const editor = this.host;
    // we need update state before executing the action in case
    // the action uses the appState it's being passed (that still
    // contains a defined contextMenu) to return the next state.
    editor.setState({ contextMenu: null }, () => {
      editor.actionManager.executeAction(action, "contextMenu");
    });
  }
}
