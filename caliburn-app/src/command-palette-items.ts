import { t } from "@excalidraw/excalidraw/i18n";

import { DEFAULT_CATEGORIES } from "../../packages/caliburn/src/index";

import { shareDialogState } from "./app-state";

import type { CollabService } from "./collab/collab.service";
import type { ShareDialogType } from "./app-state";
import type { CommandPaletteItem } from "../../packages/caliburn/src/index";

/**
 * Port of upstream `excalidraw-app/App.tsx`'s `customCommandPaletteItems`.
 * The Excalidraw+ commands (and the Plus export) are dropped. Caliburn has no
 * X, Discord or YouTube presence, so those social commands are dropped too;
 * GitHub points at this app's own repository instead of upstream's.
 */
export const buildCommandPaletteItems = (opts: {
  collab: CollabService | null;
  openShareDialog: (type: ShareDialogType) => void;
}): CommandPaletteItem[] => {
  const { collab, openShareDialog } = opts;

  return [
    {
      label: t("labels.liveCollaboration"),
      category: DEFAULT_CATEGORIES.app,
      keywords: ["team", "multiplayer", "share", "public", "session", "invite"],
      icon: "usersIcon",
      perform: () => {
        openShareDialog("collaborationOnly");
      },
    },
    {
      label: t("roomDialog.button_stopSession"),
      category: DEFAULT_CATEGORIES.app,
      predicate: () => !!collab?.isCollaborating(),
      keywords: [
        "stop",
        "session",
        "end",
        "leave",
        "close",
        "exit",
        "collaboration",
      ],
      perform: () => {
        if (collab) {
          collab.stopCollaboration();
          if (!collab.isCollaborating()) {
            shareDialogState.set({ isOpen: false });
          }
        }
      },
    },
    {
      label: t("labels.share"),
      category: DEFAULT_CATEGORIES.app,
      predicate: true,
      icon: "share",
      keywords: [
        "link",
        "shareable",
        "readonly",
        "export",
        "publish",
        "snapshot",
        "url",
        "collaborate",
        "invite",
      ],
      perform: () => {
        openShareDialog("share");
      },
    },
    {
      label: "GitHub",
      icon: "githubIcon",
      category: DEFAULT_CATEGORIES.links,
      predicate: true,
      keywords: [
        "issues",
        "bugs",
        "requests",
        "report",
        "features",
        "social",
        "community",
      ],
      perform: () => {
        window.open(
          "https://github.com/amedviediev/caliburn",
          "_blank",
          "noopener noreferrer",
        );
      },
    },
  ];
};
