import type { Action } from "@excalidraw/excalidraw/actions/types";

import type { ActionManager } from "../../actions/manager";

/**
 * Angular port of upstream `CommandPalette/types.ts`. `icon` is the ng-icon
 * registry name instead of upstream's React node (see `icons.generated.ts`),
 * and `perform`'s event is a DOM event — Angular has no synthetic ones.
 */
export type CommandPaletteItem = {
  label: string;
  /** additional keywords to match against
   * (appended to haystack, not displayed) */
  keywords?: string[];
  /**
   * string we should match against when searching
   * (deburred name + keywords)
   */
  haystack?: string;
  icon?: string;
  category: string;
  order?: number;
  predicate?: boolean | Action["predicate"];
  shortcut?: string | null;
  /** if false, command will not show while in view mode */
  viewMode?: boolean;
  perform: (data: {
    actionManager: ActionManager;
    event: MouseEvent | KeyboardEvent;
  }) => void;
};
