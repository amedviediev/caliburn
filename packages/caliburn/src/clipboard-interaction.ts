import {
  KEYS,
  MIME_TYPES,
  arrayToMap,
  distance,
  getGridPoint,
  isWritableElement,
  normalizeEOL,
  normalizeLink,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  addElementsToFrame,
  duplicateElements,
  embeddableURLValidator,
  excludeElementsInFramesFromSelection,
  filterElementsEligibleAsFrameChildren,
  getCommonBounds,
  getContainerElement,
  getEmbedLink,
  getSelectionStateForElements,
  isBoundToContainer,
  isTextElement,
  maybeParseEmbedSrc,
  newEmbeddableElement,
  newElementWith,
  redrawTextBoundingBox,
  syncInvalidIndices,
  syncMovedIndices,
} from "@excalidraw/element";

import { parseClipboard } from "@excalidraw/excalidraw/clipboard";
import { parseDataTransferEvent } from "@excalidraw/excalidraw/clipboard";
import { loadFromBlob } from "@excalidraw/excalidraw/data";
import {
  SVGStringToFile,
  isSupportedImageFile,
  loadSceneOrLibraryFromBlob,
  normalizeFile,
  parseLibraryJSON,
} from "@excalidraw/excalidraw/data/blob";
import { distributeLibraryItemsOnSquareGrid } from "@excalidraw/excalidraw/data/library";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { ImageSceneDataError } from "@excalidraw/excalidraw/errors";
import { t } from "@excalidraw/excalidraw/i18n";

import type {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type {
  ClipboardData,
  ParsedDataTransferFile,
} from "@excalidraw/excalidraw/clipboard";
import type { ExcalidrawLibraryIds } from "@excalidraw/excalidraw/data/types";
import type { BinaryFiles, LibraryItems } from "@excalidraw/excalidraw/types";
import type { SetViewportOptions } from "@excalidraw/excalidraw/viewport";

import { addTextFromPaste } from "./text-paste";
import { getTopLayerFrameAtSceneCoords } from "./text-interaction";
import { addNewImagesToImageCache, insertImages } from "./image-interaction";
import { getCurrentItemRoundness } from "./create-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

let IS_PLAIN_PASTE = false;
let IS_PLAIN_PASTE_TIMER = 0;

export const trackPlainPasteKeyDown = (event: KeyboardEvent) => {
  if (event[KEYS.CTRL_OR_CMD] && event.key.toLowerCase() === KEYS.V) {
    IS_PLAIN_PASTE = event.shiftKey;
    clearTimeout(IS_PLAIN_PASTE_TIMER);
    // reset (100ms to be safe that we it runs after the ensuing
    // paste event). Though, technically unnecessary to reset since we
    // (re)set the flag before each paste event.
    IS_PLAIN_PASTE_TIMER = window.setTimeout(() => {
      IS_PLAIN_PASTE = false;
    }, 100);
  }
};

/** drops a pending plain-paste flag (and its timer) mid-flight */
export const resetPlainPasteTracking = () => {
  clearTimeout(IS_PLAIN_PASTE_TIMER);
  IS_PLAIN_PASTE_TIMER = 0;
  IS_PLAIN_PASTE = false;
};

export const insertEmbeddableElement = (
  editor: CaliburnEditorComponent,
  {
    sceneX,
    sceneY,
    link,
  }: {
    sceneX: number;
    sceneY: number;
    link: string;
  },
) => {
  const [gridX, gridY] = getGridPoint(
    sceneX,
    sceneY,
    editor.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
      ? null
      : editor.getEffectiveGridSize(),
  );

  const embedLink = getEmbedLink(link);

  if (!embedLink) {
    return;
  }

  const element = newEmbeddableElement({
    type: "embeddable",
    x: gridX,
    y: gridY,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: editor.state.currentItemFillStyle,
    strokeWidth: editor.getCurrentItemStrokeWidth("embeddable"),
    strokeStyle: editor.state.currentItemStrokeStyle,
    roughness: editor.state.currentItemRoughness,
    roundness: getCurrentItemRoundness(editor, "embeddable"),
    opacity: editor.state.currentItemOpacity,
    locked: false,
    width: embedLink.intrinsicSize.w,
    height: embedLink.intrinsicSize.h,
    link,
  });

  editor.insertNewElement(element);

  return element;
};

export const addElementsFromPasteOrLibrary = (
  editor: CaliburnEditorComponent,
  opts: {
    elements: readonly ExcalidrawElement[];
    files: BinaryFiles | null;
    position: { clientX: number; clientY: number } | "cursor" | "center";
    retainSeed?: boolean;
    preserveFrameChildrenOrder?: boolean;
    fit?: SetViewportOptions["fit"];
  },
) => {
  const elements = restoreElements(opts.elements, null, {
    deleteInvisibleElements: true,
  });
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);

  const elementsCenterX = distance(minX, maxX) / 2;
  const elementsCenterY = distance(minY, maxY) / 2;

  const clientX =
    typeof opts.position === "object"
      ? opts.position.clientX
      : opts.position === "cursor"
      ? editor.viewport.lastPosition.x
      : editor.state.width / 2 + editor.state.offsetLeft;
  const clientY =
    typeof opts.position === "object"
      ? opts.position.clientY
      : opts.position === "cursor"
      ? editor.viewport.lastPosition.y
      : editor.state.height / 2 + editor.state.offsetTop;

  const { x, y } = viewportCoordsToSceneCoords(
    { clientX, clientY },
    editor.state,
  );

  const dx = x - elementsCenterX;
  const dy = y - elementsCenterY;

  const [gridX, gridY] = getGridPoint(dx, dy, editor.getEffectiveGridSize());

  const { duplicatedElements } = duplicateElements({
    type: "everything",
    elements: elements.map((element) => {
      return newElementWith(element, {
        x: element.x + gridX - minX,
        y: element.y + gridY - minY,
      });
    }),
    randomizeSeed: !opts.retainSeed,
    preserveFrameChildrenOrder: opts.preserveFrameChildrenOrder,
  });

  const prevElements = editor.scene.getElementsIncludingDeleted();
  let nextElements: ExcalidrawElement[] = [
    ...prevElements,
    ...duplicatedElements,
  ];

  syncMovedIndices(nextElements, arrayToMap(duplicatedElements));

  const topLayerFrame = getTopLayerFrameAtSceneCoords(editor, { x, y });

  if (topLayerFrame) {
    const eligibleElements = filterElementsEligibleAsFrameChildren(
      duplicatedElements,
      topLayerFrame,
    );
    nextElements = addElementsToFrame(
      nextElements,
      eligibleElements,
      topLayerFrame,
    );
  }

  editor.scene.replaceAllElements(nextElements);

  duplicatedElements.forEach((newElement) => {
    if (isTextElement(newElement) && isBoundToContainer(newElement)) {
      const container = getContainerElement(
        newElement,
        editor.scene.getElementsMapIncludingDeleted(),
      );
      redrawTextBoundingBox(newElement, container, editor.scene);
    }
  });

  if (opts.files) {
    editor.addMissingFiles(opts.files);
  }

  const nextElementsToSelect =
    excludeElementsInFramesFromSelection(duplicatedElements);

  editor.store.scheduleCapture();
  editor.setState(
    {
      ...editor.state,
      ...getSelectionStateForElements(
        nextElementsToSelect,
        editor.scene.getNonDeletedElements(),
        editor.state,
      ),
    },
    () => {
      if (opts.files) {
        addNewImagesToImageCache(editor);
      }
    },
  );
  editor.setActiveTool(
    { type: editor.state.preferredSelectionTool.type },
    { keepSelection: true },
  );

  if (opts.fit) {
    editor.viewport.setViewport({
      target: duplicatedElements,
      fit: opts.fit,
      animation: false,
      offsets: { ui: true },
    });
  }
};

const insertClipboardContent = async (
  editor: CaliburnEditorComponent,
  data: ClipboardData,
  dataTransferFiles: ParsedDataTransferFile[],
  isPlainPaste: boolean,
) => {
  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    {
      clientX: editor.viewport.lastPosition.x,
      clientY: editor.viewport.lastPosition.y,
    },
    editor.state,
  );

  // ------------------- Error -------------------
  if (data.errorMessage) {
    editor.setState({ errorMessage: data.errorMessage });
    return;
  }

  // ------------------- Images or SVG code -------------------
  const imageFiles = dataTransferFiles.map((data) => data.file);

  if (imageFiles.length === 0 && data.text && !isPlainPaste) {
    const trimmedText = data.text.trim();
    if (trimmedText.startsWith("<svg") && trimmedText.endsWith("</svg>")) {
      // ignore SVG validation/normalization which will be done during image
      // initialization
      imageFiles.push(SVGStringToFile(trimmedText));
    }
  }

  if (imageFiles.length > 0) {
    if (editor.isToolSupported("image")) {
      await insertImages(editor, imageFiles as File[], sceneX, sceneY);
    } else {
      editor.setState({ errorMessage: t("errors.imageToolNotSupported") });
    }
    return;
  }

  // ------------------- Elements -------------------
  if (data.elements) {
    const elements = (
      data.programmaticAPI
        ? convertToExcalidrawElements(data.elements as any[])
        : data.elements
    ) as readonly ExcalidrawElement[];
    // TODO: remove formatting from elements if isPlainPaste
    addElementsFromPasteOrLibrary(editor, {
      elements,
      files: data.files || null,
      position:
        editor.editorInterface.formFactor === "desktop" ? "cursor" : "center",
      retainSeed: isPlainPaste,
      preserveFrameChildrenOrder: true,
    });
    return;
  }

  // ------------------- Only textual stuff remaining -------------------
  if (!data.text) {
    return;
  }

  // ------------------- Pure embeddable URLs -------------------
  const nonEmptyLines = normalizeEOL(data.text)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const embbeddableUrls = nonEmptyLines
    .map((str) => maybeParseEmbedSrc(str))
    .filter(
      (string) =>
        embeddableURLValidator(string, undefined) &&
        (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(string) ||
          getEmbedLink(string)?.type === "video"),
    );

  if (
    !isPlainPaste &&
    embbeddableUrls.length > 0 &&
    embbeddableUrls.length === nonEmptyLines.length
  ) {
    const embeddables: NonDeleted<ExcalidrawEmbeddableElement>[] = [];
    for (const url of embbeddableUrls) {
      const prevEmbeddable: ExcalidrawEmbeddableElement | undefined =
        embeddables[embeddables.length - 1];
      const embeddable = insertEmbeddableElement(editor, {
        sceneX: prevEmbeddable
          ? prevEmbeddable.x + prevEmbeddable.width + 20
          : sceneX,
        sceneY,
        link: normalizeLink(url),
      });
      if (embeddable) {
        embeddables.push(embeddable);
      }
    }
    if (embeddables.length) {
      editor.store.scheduleCapture();
      editor.setState({
        selectedElementIds: Object.fromEntries(
          embeddables.map((embeddable) => [embeddable.id, true]),
        ),
      });
    }
    return;
  }

  // ------------------- Text -------------------
  addTextFromPaste(editor, data.text, isPlainPaste);
};

export const pasteFromClipboard = async (
  editor: CaliburnEditorComponent,
  event: ClipboardEvent,
) => {
  if (!editor.isInteractionEnabled()) {
    return;
  }

  const isPlainPaste = !!IS_PLAIN_PASTE;

  // #686
  const target = document.activeElement;
  const isExcalidrawActive = editor
    .containerRef()
    ?.nativeElement?.contains(target);
  if (event && !isExcalidrawActive) {
    return;
  }

  const elementUnderCursor = document.elementFromPoint(
    editor.viewport.lastPosition.x,
    editor.viewport.lastPosition.y,
  );
  if (
    event &&
    (!(elementUnderCursor instanceof HTMLCanvasElement) ||
      isWritableElement(target))
  ) {
    return;
  }

  // must be called in the same frame (thus before any awaits) as the paste
  // event else some browsers (FF...) will clear the clipboardData
  // (something something security)
  const dataTransferList = await parseDataTransferEvent(event);

  const filesList = dataTransferList.getFiles();

  const data = await parseClipboard(dataTransferList, isPlainPaste);

  await insertClipboardContent(editor, data, filesList, isPlainPaste);

  editor.setActiveTool(
    { type: editor.state.preferredSelectionTool.type },
    { keepSelection: true },
  );
  event?.preventDefault();
};

export const loadFileToCanvas = async (
  editor: CaliburnEditorComponent,
  file: File,
  fileHandle: FileSystemFileHandle | null,
) => {
  file = await normalizeFile(file);
  try {
    const elements = editor.scene.getElementsIncludingDeleted();
    let ret;
    try {
      ret = await loadSceneOrLibraryFromBlob(
        file,
        editor.state,
        elements,
        fileHandle,
      );
    } catch (error: any) {
      const imageSceneDataError = error instanceof ImageSceneDataError;
      if (
        imageSceneDataError &&
        error.code === "IMAGE_NOT_CONTAINS_SCENE_DATA" &&
        !editor.isToolSupported("image")
      ) {
        editor.setState({
          isLoading: false,
          errorMessage: t("errors.imageToolNotSupported"),
        });
        return;
      }
      const errorMessage = imageSceneDataError
        ? t("alerts.cannotRestoreFromImage")
        : t("alerts.couldNotLoadInvalidFile");
      editor.setState({
        isLoading: false,
        errorMessage,
      });
    }
    if (!ret) {
      return;
    }

    if (ret.type === MIME_TYPES.excalidraw) {
      // restore the fractional indices by mutating elements
      syncInvalidIndices(elements.concat(ret.data.elements as any));

      // don't capture and only update the store snapshot for old elements,
      // otherwise we would end up with duplicated fractional indices on undo
      editor.store.scheduleMicroAction({
        action: CaptureUpdateAction.NEVER,
        elements,
        appState: undefined,
      });

      editor.setState({ isLoading: true });
      editor.syncActionResult({
        ...ret.data,
        appState: {
          ...(ret.data.appState || editor.state),
          isLoading: false,
        },
        replaceFiles: true,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      } as any);
    } else if (ret.type === MIME_TYPES.excalidrawlib) {
      await editor.library
        .updateLibrary({
          libraryItems: file,
          merge: true,
          openLibraryMenu: true,
        })
        .catch((error) => {
          console.error(error);
          editor.setState({ errorMessage: t("errors.importLibraryError") });
        });
    }
  } catch (error: any) {
    editor.setState({ isLoading: false, errorMessage: error.message });
  }
};

export const handleAppOnDrop = async (
  editor: CaliburnEditorComponent,
  event: DragEvent,
) => {
  // NOTE no preventDefault so the host page can handle the drop itself
  if (!editor.isInteractionEnabled()) {
    return;
  }
  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    event,
    editor.state,
  );
  const dataTransferList = await parseDataTransferEvent(event);

  // must be retrieved first, in the same frame
  const fileItems = dataTransferList.getFiles();

  if (fileItems.length === 1) {
    const { file, fileHandle } = fileItems[0];

    if (
      file &&
      (file.type === MIME_TYPES.png || file.type === MIME_TYPES.svg)
    ) {
      try {
        const scene = await loadFromBlob(
          file,
          editor.state,
          editor.scene.getElementsIncludingDeleted(),
          fileHandle,
        );
        editor.syncActionResult({
          ...scene,
          appState: {
            ...(scene.appState || editor.state),
            isLoading: false,
          },
          replaceFiles: true,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        } as any);
        return;
      } catch (error: any) {
        if (error.name !== "EncodingError") {
          throw new Error(t("alerts.couldNotLoadInvalidFile"));
        }
        // if EncodingError, fall through to insert as regular image
      }
    }
  }

  const imageFiles = fileItems
    .map((data) => data.file)
    .filter((file) => isSupportedImageFile(file));

  if (imageFiles.length > 0 && editor.isToolSupported("image")) {
    return insertImages(editor, imageFiles as File[], sceneX, sceneY);
  }

  const excalidrawLibrary_ids = dataTransferList.getData(
    MIME_TYPES.excalidrawlibIds,
  );
  const excalidrawLibrary_data = dataTransferList.getData(
    MIME_TYPES.excalidrawlib,
  );
  if (excalidrawLibrary_ids || excalidrawLibrary_data) {
    try {
      let libraryItems: LibraryItems | null = null;
      if (excalidrawLibrary_ids) {
        const { itemIds } = JSON.parse(
          excalidrawLibrary_ids,
        ) as ExcalidrawLibraryIds;
        const allLibraryItems = await editor.library.getLatestLibrary();
        libraryItems = allLibraryItems.filter((item) =>
          itemIds.includes(item.id),
        );
        // legacy library dataTransfer format
      } else if (excalidrawLibrary_data) {
        libraryItems = parseLibraryJSON(excalidrawLibrary_data);
      }
      if (libraryItems?.length) {
        libraryItems = libraryItems.map((item) => ({
          ...item,
          // #6465
          elements: duplicateElements({
            type: "everything",
            elements: item.elements,
            randomizeSeed: true,
            preserveFrameChildrenOrder: true,
          }).duplicatedElements,
        }));

        addElementsFromPasteOrLibrary(editor, {
          elements: distributeLibraryItemsOnSquareGrid(libraryItems),
          position: event,
          files: null,
        });
      }
    } catch (error: any) {
      editor.setState({ errorMessage: error.message });
    }
    return;
  }

  if (fileItems.length > 0) {
    const { file, fileHandle } = fileItems[0];
    if (file) {
      // Attempt to parse an excalidraw/excalidrawlib file
      await loadFileToCanvas(editor, file, fileHandle);
    }
  }

  const textItem = dataTransferList.findByType(MIME_TYPES.text);

  if (textItem) {
    const text = textItem.value;
    if (
      text &&
      embeddableURLValidator(text, undefined) &&
      (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(text) ||
        getEmbedLink(text)?.type === "video")
    ) {
      const embeddable = insertEmbeddableElement(editor, {
        sceneX,
        sceneY,
        link: normalizeLink(text),
      });
      if (embeddable) {
        editor.store.scheduleCapture();
        editor.setState({ selectedElementIds: { [embeddable.id]: true } });
      }
    }
  }
};
