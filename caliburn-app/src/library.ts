import {
  APP_NAME,
  EVENT,
  URL_HASH_KEYS,
  URL_QUERY_KEYS,
} from "@excalidraw/common";
import { toValidURL } from "@excalidraw/common";
import {
  parseLibraryTokensFromUrl,
  validateLibraryUrl,
} from "@excalidraw/excalidraw/data/library";
import { t } from "@excalidraw/excalidraw/i18n";

import type { LibraryItems } from "@excalidraw/excalidraw/types";

import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
} from "./data/LocalData";

import type { CaliburnImperativeAPI } from "../../packages/caliburn/src/index";

/**
 * The app's half of upstream's `useHandleLibrary` hook (`data/library.ts`):
 * load the persisted library into a freshly mounted editor, install a library
 * arriving through `#addLibrary=`, and migrate the legacy localStorage store.
 *
 * The save half is the editor's `onLibraryChange` prop
 * (`persistLibraryItems` below) rather than upstream's
 * `onLibraryUpdateEmitter` + `AdapterTransaction`, which are internal to the
 * vendored package: this writes the whole library on every change, where
 * upstream merges the update into whatever the store holds at that moment.
 * Same result for a single tab; a second tab editing the library
 * simultaneously wins outright here instead of being merged.
 */
let detachHashChange: (() => void) | null = null;

const importLibraryFromURL = async (
  excalidrawAPI: CaliburnImperativeAPI,
  { libraryUrl, idToken }: { libraryUrl: string; idToken: string | null },
) => {
  const libraryPromise = new Promise<Blob>(async (resolve, reject) => {
    try {
      libraryUrl = toValidURL(decodeURIComponent(libraryUrl));

      validateLibraryUrl(libraryUrl);

      const request = await fetch(libraryUrl);
      const blob = await request.blob();
      resolve(blob);
    } catch (error: any) {
      reject(error);
    }
  });

  const shouldPrompt = idToken !== excalidrawAPI.id;

  // wait for the tab to be focused before continuing in case we'll prompt
  // for confirmation
  await (shouldPrompt && document.hidden
    ? new Promise<void>((resolve) => {
        window.addEventListener("focus", () => resolve(), { once: true });
      })
    : null);

  try {
    await excalidrawAPI.updateLibrary({
      libraryItems: libraryPromise,
      prompt: shouldPrompt,
      merge: true,
      defaultStatus: "published",
      openLibraryMenu: true,
    });
  } catch (error: any) {
    excalidrawAPI.updateScene({
      appState: { errorMessage: error.message },
    });
    throw error;
  } finally {
    if (window.location.hash.includes(URL_HASH_KEYS.addLibrary)) {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      hash.delete(URL_HASH_KEYS.addLibrary);
      window.history.replaceState({}, APP_NAME, `#${hash.toString()}`);
    } else if (window.location.search.includes(URL_QUERY_KEYS.addLibrary)) {
      const query = new URLSearchParams(window.location.search);
      query.delete(URL_QUERY_KEYS.addLibrary);
      window.history.replaceState({}, APP_NAME, `?${query.toString()}`);
    }
  }
};

export const handleLibrary = (excalidrawAPI: CaliburnImperativeAPI) => {
  const legacyData = LibraryLocalStorageMigrationAdapter.load();

  const loaded = legacyData
    ? Promise.resolve(legacyData.libraryItems as LibraryItems).then(
        async (libraryItems) => {
          await LibraryIndexedDBAdapter.save({ libraryItems });
          LibraryLocalStorageMigrationAdapter.clear();
          return libraryItems;
        },
      )
    : LibraryIndexedDBAdapter.load().then((data) => data?.libraryItems ?? []);

  excalidrawAPI
    .updateLibrary({
      // merge with current library items because we may have already
      // populated it (e.g. by installing 3rd party library which can
      // happen before the DB data is loaded)
      libraryItems: loaded,
      merge: true,
    })
    .catch((error: any) => {
      console.error(`couldn't load library: ${error.message}`);
    });

  const libraryUrlTokens = parseLibraryTokensFromUrl();
  if (libraryUrlTokens) {
    importLibraryFromURL(excalidrawAPI, libraryUrlTokens).catch(() => {
      // reported to the user through `updateScene`'s `errorMessage`
    });
  }

  const onHashChange = (event: HashChangeEvent) => {
    event.preventDefault();
    const tokens = parseLibraryTokensFromUrl();
    if (tokens) {
      event.stopImmediatePropagation();
      // If hash changed and it contains library url, import it and replace
      // the url to its previous state (important in case of collaboration
      // and similar).
      // Using history API won't trigger another hashchange.
      window.history.replaceState({}, "", event.oldURL);

      importLibraryFromURL(excalidrawAPI, tokens).catch(() => {
        // as above
      });
    }
  };

  detachHashChange?.();
  window.addEventListener(EVENT.HASHCHANGE, onHashChange);
  detachHashChange = () => {
    window.removeEventListener(EVENT.HASHCHANGE, onHashChange);
  };
};

export const persistLibraryItems = async (
  excalidrawAPI: CaliburnImperativeAPI | null,
  libraryItems: LibraryItems,
) => {
  try {
    await LibraryIndexedDBAdapter.save({ libraryItems });
  } catch (error: any) {
    console.error(`couldn't persist library update: ${error.message}`);
    excalidrawAPI?.updateScene({
      appState: { errorMessage: t("errors.saveLibraryError") },
    });
  }
};
