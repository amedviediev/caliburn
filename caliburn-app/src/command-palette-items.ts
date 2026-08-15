import { t } from "@excalidraw/excalidraw/i18n";

import { DEFAULT_CATEGORIES } from "../../packages/caliburn/src/index";

import type { CollabService } from "./collab/collab.service";
import type { ShareDialogType } from "./app-state";
import type { CommandPaletteItem } from "../../packages/caliburn/src/index";

/**
 * Port of upstream `excalidraw-app/App.tsx`'s `customCommandPaletteItems`.
 * The Excalidraw+ commands (and the Plus export) are dropped; the social
 * links keep upstream's URLs, which genuinely point at the upstream project.
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
          "https://github.com/excalidraw/excalidraw",
          "_blank",
          "noopener noreferrer",
        );
      },
    },
    {
      label: t("labels.followUs"),
      icon: "xBrandIcon",
      category: DEFAULT_CATEGORIES.links,
      predicate: true,
      keywords: ["twitter", "contact", "social", "community"],
      perform: () => {
        window.open(
          "https://x.com/excalidraw",
          "_blank",
          "noopener noreferrer",
        );
      },
    },
    {
      label: t("labels.discordChat"),
      category: DEFAULT_CATEGORIES.links,
      predicate: true,
      icon: "discordIcon",
      keywords: [
        "chat",
        "talk",
        "contact",
        "bugs",
        "requests",
        "report",
        "feedback",
        "suggestions",
        "social",
        "community",
      ],
      perform: () => {
        window.open(
          "https://discord.gg/UexuTaE",
          "_blank",
          "noopener noreferrer",
        );
      },
    },
    {
      label: "YouTube",
      icon: "youtubeIcon",
      category: DEFAULT_CATEGORIES.links,
      predicate: true,
      keywords: ["features", "tutorials", "howto", "help", "community"],
      perform: () => {
        window.open(
          "https://youtube.com/@excalidraw",
          "_blank",
          "noopener noreferrer",
        );
      },
    },
  ];
};
