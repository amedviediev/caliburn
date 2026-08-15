import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";

import {
  APP_NAME,
  EVENT,
  debounce,
  isRunningInIframe,
  isTestEnv,
  preventUnload,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  isInitializedImageElement,
  newElementWith,
} from "@excalidraw/element";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { reconcileElements } from "@excalidraw/excalidraw/data/reconcile";
import {
  bumpElementVersions,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { t } from "@excalidraw/excalidraw/i18n";
import { getScrollToContentState } from "@excalidraw/excalidraw/viewport";
import { parseLibraryTokensFromUrl } from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";

import type { LibraryItems } from "@excalidraw/excalidraw/types";

import {
  CaliburnEditorComponent,
  CaliburnErrorDialogComponent,
  CaliburnLiveCollaborationTriggerComponent,
  CaliburnShareableLinkDialogComponent,
  CaliburnWelcomeScreenMenuHintComponent,
  openConfirmModal,
} from "../../packages/caliburn/src/index";

import {
  appLangCode,
  loadLanguage,
  loadedLangCode,
  setAppLangCode,
} from "./app-language/language-state";
import { getPreferredLanguage } from "./app-language/language-detector";
import {
  isCollaborating,
  isOffline,
  localStorageQuotaExceeded,
  shareDialogState,
} from "./app-state";
import { AppThemeService } from "./app-theme.service";
import {
  FIREBASE_STORAGE_PREFIXES,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import { CollabService } from "./collab/collab.service";
import { CaliburnAppCollabErrorComponent } from "./collab/collab-error.component";
import { CaliburnAppFooterComponent } from "./components/app-footer.component";
import { CaliburnAppMainMenuComponent } from "./components/app-main-menu.component";
import { CaliburnAppWelcomeScreenComponent } from "./components/app-welcome-screen.component";
import {
  exportToBackend,
  getCollaborationLinkData,
  importFromBackend,
  isCollaborationLink,
} from "./data";
import { updateStaleImageStatuses } from "./data/FileManager";
import { FileStatusStore } from "./data/fileStatusStore";
import { loadFilesFromFirebase } from "./data/firebase";
import { LibraryIndexedDBAdapter, LocalData } from "./data/LocalData";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { CaliburnAppShareDialogComponent } from "./share/share-dialog.component";
import { buildCommandPaletteItems } from "./command-palette-items";
import { handleLibrary, persistLibraryItems } from "./library";

import type { CollabService as Collab } from "./collab/collab.service";

import type { CaliburnImperativeAPI } from "../../packages/caliburn/src/index";
import type { OnDestroy } from "@angular/core";

/** upstream keeps this as a module constant; here it is resolved per call,
 * since the locale is loaded after this module is imported */
const shareableLinkConfirmDialog = () =>
  ({
    title: t("overwriteConfirm.modal.shareableLink.title"),
    descriptionKey: "overwriteConfirm.modal.shareableLink.description",
    actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
    color: "danger",
  } as const);

type InitializedScene = {
  scene: ExcalidrawInitialDataState | null;
} & (
  | { isExternalScene: true; id: string; key: string }
  | { isExternalScene: false; id?: null; key?: null }
);

/**
 * Port of upstream `excalidraw-app/App.tsx`'s `initializeScene`. The confirm
 * modal is the editor's own (which takes the editor instead of a module-level
 * atom), so the caller hands in a way to reach it — resolved at the point of
 * use, since the editor may be rebuilt between calls.
 */
const initializeScene = async (opts: {
  collab: Collab | null;
  excalidrawAPI: CaliburnImperativeAPI;
  getEditor: () => CaliburnEditorComponent;
}): Promise<InitializedScene> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();

  let scene: Omit<
    RestoredDataState,
    // we're not storing files in the scene database/localStorage, and instead
    // fetch them async from a different store
    "files"
  > & {
    scrollToContent?: boolean;
  } = {
    elements: restoreElements(localDataState?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(localDataState?.appState, null),
  };

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(opts.getEditor(), shareableLinkConfirmDialog()))
    ) {
      if (jsonBackendMatch) {
        const imported = await importFromBackend(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
        );

        scene = {
          elements: bumpElementVersions(
            restoreElements(imported.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            localDataState?.elements,
          ),
          appState: restoreAppState(
            imported.appState,
            // local appState when importing from backend to ensure we restore
            // localStorage user settings which we do not persist on server.
            localDataState?.appState,
          ),
        };
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(opts.getEditor(), shareableLinkConfirmDialog()))
      ) {
        return { scene: data, isExternalScene: false };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene: false,
      };
    }
  }

  if (roomLinkData && opts.collab) {
    const { excalidrawAPI } = opts;

    const collabScene = await opts.collab.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...collabScene,
        appState: {
          ...restoreAppState(
            {
              ...collabScene?.appState,
              theme:
                localDataState?.appState?.theme || collabScene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          collabScene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene: true,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

/**
 * Angular port of upstream `excalidraw-app/App.tsx`'s `ExcalidrawWrapper` —
 * the app shell: initial scene resolution, the local persistence and
 * browser-tab sync wiring, theme and language handling, and the chrome it
 * composes into the editor's host slots.
 *
 * Upstream hands the editor a promise as `initialData` and lets it apply the
 * scene once it resolves; caliburn's editor reads `initialData` when it
 * mounts, so the resolved scene is applied through `updateScene` instead —
 * the same path upstream's own `hashchange` handler takes.
 *
 * The `TopErrorBoundary`, the visual debugger, the simulated collaborators,
 * `CustomStats` and the AI/Excalidraw+ surfaces are not ported.
 */
@Component({
  selector: "caliburn-app",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    CaliburnAppCollabErrorComponent,
    CaliburnAppFooterComponent,
    CaliburnAppMainMenuComponent,
    CaliburnAppShareDialogComponent,
    CaliburnAppWelcomeScreenComponent,
    CaliburnEditorComponent,
    CaliburnErrorDialogComponent,
    CaliburnLiveCollaborationTriggerComponent,
    CaliburnShareableLinkDialogComponent,
    CaliburnWelcomeScreenMenuHintComponent,
  ],
  templateUrl: "./app.component.html",
})
export class CaliburnAppComponent implements OnDestroy {
  private readonly appThemeService = inject(AppThemeService);
  protected readonly collab = inject(CollabService);

  private readonly editorRef = viewChild(CaliburnEditorComponent);

  /**
   * Bumped to rebuild the editor on a language change: caliburn's chrome
   * resolves its labels when each component is constructed (upstream resolves
   * them on every render), so a language switch only reaches the UI by
   * rebuilding it. The scene travels across the rebuild as `initialData`.
   */
  protected readonly editorGeneration = signal(0);

  protected readonly initialData = signal<{
    elements?: readonly OrderedExcalidrawElement[];
    appState?: Partial<AppState>;
  } | null>(null);

  protected readonly isCollabDisabled = isRunningInIframe();
  protected readonly isCollabEnabled = !this.isCollabDisabled;
  protected readonly isCollaborating = isCollaborating;
  protected readonly isOffline = isOffline;
  protected readonly localStorageQuotaExceeded = localStorageQuotaExceeded;
  protected readonly appTheme = this.appThemeService.appTheme;
  protected readonly editorTheme = this.appThemeService.editorTheme;
  protected readonly setAppTheme = this.appThemeService.setAppTheme;
  /** the app's own labels live outside the rebuilt editor subtree, so they
   * are resolved per render against the loaded language */
  protected readonly menuHintLabel = computed(() => {
    loadedLangCode();
    return t("welcomeScreen.app.menuHint");
  });
  protected readonly collabOfflineWarning = computed(() => {
    loadedLangCode();
    return t("alerts.collabOfflineWarning");
  });
  protected readonly localStorageQuotaExceededWarning = computed(() => {
    loadedLangCode();
    return t("alerts.localStorageQuotaExceeded");
  });

  /**
   * Upstream's `<InitializeApp langCode>` gate: the editor is held back until
   * the detected language is loaded, because caliburn's chrome resolves its
   * labels when each component is constructed. Upstream shows a
   * `LoadingMessage` meanwhile; caliburn has no port of it, so nothing is
   * rendered for the (usually sub-frame) duration of the locale fetch.
   */
  protected readonly languageLoaded = signal(false);

  protected readonly latestShareableLink = signal<string | null>(null);
  protected readonly errorMessage = signal<string>("");

  protected readonly commandPaletteItems = computed(() => {
    loadedLangCode();
    return buildCommandPaletteItems({
      collab: this.isCollabDisabled ? null : this.collab,
      openShareDialog: (type) => shareDialogState.set({ isOpen: true, type }),
    });
  });

  private excalidrawAPI: CaliburnImperativeAPI | null = null;
  private pendingFiles: BinaryFiles | null = null;
  private collabStarted = false;
  private initialized = false;
  private detachHandlers: (() => void) | null = null;

  constructor() {
    loadLanguage(appLangCode()).finally(() => {
      this.languageLoaded.set(true);
    });
  }

  /** upstream's `onExcalidrawAPI` callback, re-run on every editor remount */
  protected readonly onExcalidrawAPI = (api: CaliburnImperativeAPI) => {
    this.excalidrawAPI = api;

    if (this.pendingFiles) {
      api.addFiles(Object.values(this.pendingFiles));
      this.pendingFiles = null;
    }

    if (!this.isCollabDisabled) {
      if (this.collabStarted) {
        this.collab.excalidrawAPI = api;
      } else {
        this.collabStarted = true;
        this.collab.start(api);
      }
    }

    api.onChange((elements, appState, files) => {
      this.onChange(
        elements as readonly OrderedExcalidrawElement[],
        appState,
        files,
      );
    });

    handleLibrary(api);

    if (!this.initialized) {
      this.initialized = true;
      this.initialize(api);
    }
  };

  protected readonly onLibraryChange = (libraryItems: LibraryItems) => {
    persistLibraryItems(this.excalidrawAPI, libraryItems);
  };

  ngOnDestroy() {
    this.detachHandlers?.();
    this.collab.destroy();
  }

  /**
   * The language select (and the browser-tab sync) only write `appLangCode`;
   * loading the locale and rebuilding the editor around the current scene
   * happens here, as upstream's `langCode` prop does on the React side. The
   * startup load is the constructor's, so this only fires on a change.
   */
  private readonly applyLanguage = effect(() => {
    const langCode = appLangCode();
    if (
      !this.languageLoaded() ||
      langCode === loadedLangCode() ||
      langCode === this.loadingLangCode
    ) {
      return;
    }
    this.reloadLanguage(langCode);
  });

  private loadingLangCode: string | null = null;

  /** upstream's initial-load effect */
  private initialize(excalidrawAPI: CaliburnImperativeAPI) {
    const collab = this.isCollabDisabled ? null : this.collab;
    isCollaborating.set(isCollaborationLink(window.location.href));

    initializeScene({
      collab,
      excalidrawAPI,
      getEditor: () => this.editorRef()!,
    }).then((data) => {
      this.loadImages(data, /* isInitialLoad */ true);
      this.applyScene(data.scene, /* isInitialLoad */ true);
    });

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const api = this.excalidrawAPI;
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens && api) {
        if (
          collab?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collab.stopCollaboration(false);
        }
        api.updateScene({ appState: { isLoading: true } });

        initializeScene({
          collab,
          excalidrawAPI: api,
          getEditor: () => this.editorRef()!,
        }).then((data) => {
          this.loadImages(data);
          this.applyScene(data.scene);
        });
      }
    };

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      const excalidrawAPI = this.excalidrawAPI;
      if (!excalidrawAPI) {
        return;
      }
      if (
        !document.hidden &&
        ((collab && !collab.isCollaborating()) || this.isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setAppLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collab?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        this.excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          this.excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);

    this.detachHandlers = () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }

  /**
   * Applies a resolved scene to the mounted editor — upstream resolves its
   * `initialData` promise instead, which ends in the same `restore*` calls
   * (`App.initializeScene`).
   */
  private applyScene(
    scene: ExcalidrawInitialDataState | null,
    isInitialLoad = false,
  ) {
    const excalidrawAPI = this.excalidrawAPI;
    if (!scene || !excalidrawAPI) {
      return;
    }

    const elements = restoreElements(scene.elements, null, {
      repairBindings: true,
    });
    const appState = restoreAppState(scene.appState, null);

    excalidrawAPI.updateScene({
      elements,
      appState: {
        ...appState,
        ...(scene.scrollToContent
          ? getScrollToContentState(elements, {
              ...excalidrawAPI.getAppState(),
              ...appState,
            } as AppState)
          : null),
        isLoading: false,
      },
      captureUpdate: isInitialLoad
        ? // the initial scene is what the editor would have restored from
          // `initialData` — not an edit, and not undoable
          CaptureUpdateAction.NEVER
        : CaptureUpdateAction.IMMEDIATELY,
    });

    if (isInitialLoad) {
      excalidrawAPI.history.clear();
    }
  }

  /** upstream's hoisted `loadImages` */
  private loadImages(
    data: ResolutionType<typeof initializeScene>,
    isInitialLoad = false,
  ) {
    const excalidrawAPI = this.excalidrawAPI;
    if (!data.scene || !excalidrawAPI) {
      return;
    }

    const collab = this.isCollabDisabled ? null : this.collab;

    if (collab?.isCollaborating()) {
      if (data.scene.elements) {
        collab
          .fetchImageFilesFromFirebase({
            elements: data.scene.elements,
            forceFetchFiles: true,
          })
          .then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          });
      }
    } else {
      const fileIds =
        data.scene.elements?.reduce((acc, element) => {
          if (isInitializedImageElement(element)) {
            return acc.concat(element.fileId);
          }
          return acc;
        }, [] as FileId[]) || [];

      if (data.isExternalScene) {
        if (fileIds.length) {
          // Direct Firebase call (not through FileManager), so track manually
          FileStatusStore.updateStatuses(fileIds.map((id) => [id, "loading"]));
        }
        loadFilesFromFirebase(
          `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
          data.key,
          fileIds,
        ).then(({ loadedFiles, erroredFiles }) => {
          excalidrawAPI.addFiles(loadedFiles);
          updateStaleImageStatuses({
            excalidrawAPI,
            erroredFiles,
            elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
          });
          FileStatusStore.updateStatuses([
            ...loadedFiles.map((f) => [f.id, "loaded"] as [FileId, "loaded"]),
            ...[...erroredFiles.keys()].map(
              (id) => [id, "error"] as [FileId, "error"],
            ),
          ]);
        });
      } else if (isInitialLoad) {
        if (fileIds.length) {
          LocalData.fileStorage
            .getFiles(fileIds)
            .then(async ({ loadedFiles, erroredFiles }) => {
              if (loadedFiles.length) {
                excalidrawAPI.addFiles(loadedFiles);
              }
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
        // on fresh load, clear unused files from IDB (from previous
        // session)
        LocalData.fileStorage.clearObsoleteFiles({
          currentFileIds: fileIds,
        });
      }
    }
  }

  /** upstream's `onChange` */
  private onChange(
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) {
    if (!this.isCollabDisabled && this.collab.isCollaborating()) {
      this.collab.syncElements(elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        const excalidrawAPI = this.excalidrawAPI;
        if (excalidrawAPI) {
          let didChange = false;

          const nextElements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements: nextElements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }
  }

  /** upstream's `onExportToBackend` */
  protected readonly onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        this.latestShareableLink.set(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  /** the share dialog's "export to link" button */
  protected readonly exportToBackendFromShareDialog = async () => {
    const excalidrawAPI = this.excalidrawAPI;
    if (excalidrawAPI) {
      try {
        await this.onExportToBackend(
          excalidrawAPI.getSceneElements(),
          excalidrawAPI.getAppState(),
          excalidrawAPI.getFiles(),
        );
      } catch (error: any) {
        this.errorMessage.set(error.message);
      }
    }
  };

  protected readonly openCollabDialog = () => {
    shareDialogState.set({ isOpen: true, type: "collaborationOnly" });
  };

  protected readonly openShareDialog = () => {
    shareDialogState.set({ isOpen: true, type: "share" });
  };

  protected clearErrorMessage() {
    this.errorMessage.set("");
  }

  protected clearCollabError() {
    this.collab.setErrorDialog(null);
  }

  protected closeShareableLinkDialog() {
    this.latestShareableLink.set(null);
  }

  private async reloadLanguage(langCode: string) {
    this.loadingLangCode = langCode;
    await loadLanguage(langCode);
    this.loadingLangCode = null;

    const excalidrawAPI = this.excalidrawAPI;
    if (!excalidrawAPI) {
      // nothing to rebuild before the editor has mounted once
      return;
    }

    this.initialData.set({
      elements:
        excalidrawAPI.getSceneElementsIncludingDeleted() as readonly OrderedExcalidrawElement[],
      appState: excalidrawAPI.getAppState(),
    });
    this.pendingFiles = excalidrawAPI.getFiles();

    this.editorGeneration.update((generation) => generation + 1);
  }
}
