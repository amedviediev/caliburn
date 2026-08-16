import { signal } from "@angular/core";

import type { UserToFollow } from "@excalidraw/excalidraw/types";

import type { WritableSignal } from "@angular/core";

/**
 * The app's cross-module state, replacing upstream `app-jotai.ts`'s store of
 * atoms: each upstream `atom(initial)` is a module-level Angular signal, read
 * the same way from plain TS (`someState()`) and directly from templates.
 * Angular components read them without a `Provider` wrapper, so upstream's
 * jotai `Provider` / `useAtomWithInitialValue` have no port.
 *
 * Kept in one module (rather than beside each consumer, as upstream does)
 * because the collab service, the share dialog and the app shell all read
 * each other's slices, and module-level signals must not create import
 * cycles between those files.
 */

/** upstream `collab/Collab.tsx`'s `isCollaboratingAtom` */
export const isCollaborating = signal(false);

/** upstream `collab/Collab.tsx`'s `isOfflineAtom` */
export const isOffline = signal(false);

/** upstream `collab/Collab.tsx`'s `activeRoomLinkAtom` */
export const activeRoomLink = signal<string | null>(null);

/** upstream `collab/Collab.tsx`'s `userToFollowAtom` */
export const userToFollow = signal<UserToFollow | null>(null);

/** upstream `data/LocalData.ts`'s `localStorageQuotaExceededAtom` */
export const localStorageQuotaExceeded = signal(false);

export type CollabErrorIndicator = {
  message: string | null;
  /** used to restart the shake animation on a repeated error */
  nonce: number;
};

/** upstream `collab/CollabError.tsx`'s `collabErrorIndicatorAtom` */
export const collabErrorIndicator: WritableSignal<CollabErrorIndicator> =
  signal({ message: null, nonce: 0 });

export type ShareDialogType = "share" | "collaborationOnly";

/** upstream `share/ShareDialog.tsx`'s `shareDialogStateAtom` */
export const shareDialogState = signal<
  { isOpen: false } | { isOpen: true; type: ShareDialogType }
>({ isOpen: false });
