import throttle from "lodash.throttle";

import {
  IMAGE_MIME_TYPES,
  IMAGE_RENDER_TIMEOUT,
  KEYS,
  MIME_TYPES,
  arrayToMap,
  getGridPoint,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  ShapeCache,
  getInitializedImageElements,
  isInitializedImageElement,
  makeNextSelectedElementIds,
  newElementWith,
  newImageElement,
  normalizeSVG,
  positionElementsOnGrid,
  updateImageCache as _updateImageCache,
} from "@excalidraw/element";

import {
  SVGStringToFile,
  generateIdFromFile,
  getDataURL,
  isSupportedImageFile,
  normalizeFile,
  resizeImageFile,
} from "@excalidraw/excalidraw/data/blob";
import { fileOpen } from "@excalidraw/excalidraw/data/filesystem";
import { t } from "@excalidraw/excalidraw/i18n";

import type {
  ExcalidrawImageElement,
  FileId,
  InitializedExcalidrawImageElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import { actionFinalize } from "./actions/actionFinalize";
import { getTopLayerFrameAtSceneCoords } from "./text-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

export const newImagePlaceholder = (
  editor: CaliburnEditorComponent,
  {
    sceneX,
    sceneY,
    addToFrameUnderCursor = true,
  }: {
    sceneX: number;
    sceneY: number;
    addToFrameUnderCursor?: boolean;
  },
) => {
  const [gridX, gridY] = getGridPoint(
    sceneX,
    sceneY,
    editor.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
      ? null
      : editor.getEffectiveGridSize(),
  );

  const topLayerFrame = addToFrameUnderCursor
    ? getTopLayerFrameAtSceneCoords(editor, {
        x: gridX,
        y: gridY,
      })
    : null;

  const placeholderSize = 100 / editor.state.zoom.value;

  return newImageElement({
    type: "image",
    strokeColor: editor.state.currentItemStrokeColor,
    backgroundColor: editor.state.currentItemBackgroundColor,
    fillStyle: editor.state.currentItemFillStyle,
    strokeWidth: editor.getCurrentItemStrokeWidth("image"),
    strokeStyle: editor.state.currentItemStrokeStyle,
    roughness: editor.state.currentItemRoughness,
    roundness: null,
    opacity: editor.state.currentItemOpacity,
    locked: false,
    frameId: topLayerFrame ? topLayerFrame.id : null,
    x: gridX - placeholderSize / 2,
    y: gridY - placeholderSize / 2,
    width: placeholderSize,
    height: placeholderSize,
  });
};

/**
 * use during async image initialization,
 * when the placeholder image could have been modified in the meantime,
 * and when you don't want to loose those modifications
 */
const getLatestInitializedImageElement = (
  editor: CaliburnEditorComponent,
  imagePlaceholder: ExcalidrawImageElement,
  fileId: FileId,
) => {
  const latestImageElement =
    editor.scene.getElement(imagePlaceholder.id) ?? imagePlaceholder;

  return newElementWith(
    latestImageElement as NonDeleted<InitializedExcalidrawImageElement>,
    {
      fileId,
    },
  );
};

const getImageNaturalDimensions = (
  editor: CaliburnEditorComponent,
  imageElement: ExcalidrawImageElement,
  imageHTML: HTMLImageElement,
) => {
  const minHeight = Math.max(editor.state.height - 120, 160);
  // max 65% of canvas height, clamped to <300px, vh - 120px>
  const maxHeight = Math.min(
    minHeight,
    Math.floor(editor.state.height * 0.5) / editor.state.zoom.value,
  );

  const height = Math.min(imageHTML.naturalHeight, maxHeight);
  const width = height * (imageHTML.naturalWidth / imageHTML.naturalHeight);

  // add current imageElement width/height to account for previous centering
  // of the placeholder image
  const x = imageElement.x + imageElement.width / 2 - width / 2;
  const y = imageElement.y + imageElement.height / 2 - height / 2;

  return {
    x,
    y,
    width,
    height,
    crop: null,
  };
};

/** updates image cache, refreshing updated elements and/or setting status
    to error for images that fail during <img> element creation */
export const updateImageCache = async (
  editor: CaliburnEditorComponent,
  elements: readonly InitializedExcalidrawImageElement[],
  files = editor.files,
) => {
  const { updatedFiles, erroredFiles } = await _updateImageCache({
    imageCache: editor.imageCache,
    fileIds: elements.map((element) => element.fileId),
    files,
  });

  if (erroredFiles.size) {
    editor.store.scheduleAction(CaptureUpdateAction.NEVER);
    editor.scene.replaceAllElements(
      editor.scene.getElementsIncludingDeleted().map((element) => {
        if (
          isInitializedImageElement(element) &&
          erroredFiles.has(element.fileId)
        ) {
          return newElementWith(element, {
            status: "error",
          });
        }
        return element;
      }),
    );
  }

  return { updatedFiles, erroredFiles };
};

/** adds new images to imageCache and re-renders if needed */
export const addNewImagesToImageCache = async (
  editor: CaliburnEditorComponent,
  imageElements: InitializedExcalidrawImageElement[] = getInitializedImageElements(
    editor.scene.getNonDeletedElements(),
  ),
  files: BinaryFiles = editor.files,
) => {
  const uncachedImageElements = imageElements.filter(
    (element) => !element.isDeleted && !editor.imageCache.has(element.fileId),
  );

  if (uncachedImageElements.length) {
    const { updatedFiles } = await updateImageCache(
      editor,
      uncachedImageElements,
      files,
    );

    if (updatedFiles.size) {
      for (const element of uncachedImageElements) {
        if (updatedFiles.has(element.fileId)) {
          ShapeCache.delete(element);
        }
      }
    }

    if (updatedFiles.size) {
      editor.scene.triggerUpdate();
    }
  }
};

/** generally you should use `addNewImagesToImageCache()` directly if you need
 *  to render new images. This is just a failsafe  */
export const createScheduleImageRefresh = (editor: CaliburnEditorComponent) =>
  throttle(() => {
    addNewImagesToImageCache(editor);
  }, IMAGE_RENDER_TIMEOUT);

const initializeImage = async (
  editor: CaliburnEditorComponent,
  placeholderImageElement: ExcalidrawImageElement,
  imageFile: File,
) => {
  // at this point this should be guaranteed image file, but we do this check
  // to satisfy TS down the line
  if (!isSupportedImageFile(imageFile)) {
    throw new Error(t("errors.unsupportedFileType"));
  }
  const mimeType = imageFile.type;

  editor.cursor.set("wait");

  if (mimeType === MIME_TYPES.svg) {
    try {
      imageFile = SVGStringToFile(
        normalizeSVG(await imageFile.text()),
        imageFile.name,
      );
    } catch (error: any) {
      console.warn(error);
      throw new Error(t("errors.svgImageInsertError"));
    }
  }

  // generate image id (by default the file digest) before any
  // resizing/compression takes place to keep it more portable
  const fileId = await generateIdFromFile(imageFile);

  if (!fileId) {
    console.warn(
      "Couldn't generate file id or the supplied `generateIdForFile` didn't resolve to one.",
    );
    throw new Error(t("errors.imageInsertError"));
  }

  const existingFileData = editor.files[fileId];
  if (!existingFileData?.dataURL) {
    const { maxWidthOrHeight, maxFileSizeBytes } = editor.props.imageOptions;

    try {
      imageFile = await resizeImageFile(imageFile, {
        maxWidthOrHeight,
      });
    } catch (error: any) {
      console.error("Error trying to resizing image file on insertion", error);
    }

    if (imageFile.size > maxFileSizeBytes) {
      throw new Error(
        t("errors.fileTooBig", {
          maxSize: `${Math.trunc(maxFileSizeBytes / 1024 / 1024)}MB`,
        }),
      );
    }
  }

  const dataURL =
    editor.files[fileId]?.dataURL || (await getDataURL(imageFile));

  return new Promise<NonDeleted<InitializedExcalidrawImageElement>>(
    async (resolve, reject) => {
      try {
        let initializedImageElement = getLatestInitializedImageElement(
          editor,
          placeholderImageElement,
          fileId,
        );

        editor.addMissingFiles([
          {
            mimeType,
            id: fileId,
            dataURL,
            created: Date.now(),
            lastRetrieved: Date.now(),
          },
        ]);

        if (!editor.imageCache.get(fileId)) {
          addNewImagesToImageCache(editor);

          const { erroredFiles } = await updateImageCache(editor, [
            initializedImageElement,
          ]);

          if (erroredFiles.size) {
            throw new Error("Image cache update resulted with an error.");
          }
        }

        const imageHTML = await editor.imageCache.get(fileId)?.image;

        if (
          imageHTML &&
          editor.state.newElement?.id !== initializedImageElement.id
        ) {
          initializedImageElement = getLatestInitializedImageElement(
            editor,
            placeholderImageElement,
            fileId,
          );

          const naturalDimensions = getImageNaturalDimensions(
            editor,
            initializedImageElement,
            imageHTML,
          );

          // no need to create a new instance anymore, just assign the natural dimensions
          Object.assign(initializedImageElement, naturalDimensions);
        }

        resolve(initializedImageElement);
      } catch (error: any) {
        console.error(error);
        reject(new Error(t("errors.imageInsertError")));
      }
    },
  );
};

export const insertImages = async (
  editor: CaliburnEditorComponent,
  imageFiles: File[],
  sceneX: number,
  sceneY: number,
) => {
  const gridPadding = 50 / editor.state.zoom.value;
  // Create, position, and insert placeholders
  const placeholders = positionElementsOnGrid(
    imageFiles.map(() => newImagePlaceholder(editor, { sceneX, sceneY })),
    sceneX,
    sceneY,
    gridPadding,
  );
  editor.insertNewElements(placeholders);

  // Create, position, insert and select initialized (replacing placeholders)
  const initialized = await Promise.all(
    placeholders.map(async (placeholder, i) => {
      try {
        return await initializeImage(
          editor,
          placeholder,
          await normalizeFile(imageFiles[i]),
        );
      } catch (error: any) {
        editor.setState({
          errorMessage: error.message || t("errors.imageInsertError"),
        });
        return newElementWith(placeholder as ExcalidrawImageElement, {
          isDeleted: true,
        });
      }
    }),
  );
  const initializedMap = arrayToMap(initialized);

  const positioned = positionElementsOnGrid(
    initialized.filter((el) => !el.isDeleted),
    sceneX,
    sceneY,
    gridPadding,
  );
  const positionedMap = arrayToMap(positioned);

  const nextElements = editor.scene
    .getElementsIncludingDeleted()
    .map((el) => positionedMap.get(el.id) ?? initializedMap.get(el.id) ?? el);

  editor.updateScene({
    appState: {
      selectedElementIds: makeNextSelectedElementIds(
        Object.fromEntries(positioned.map((el) => [el.id, true])),
        editor.state,
      ),
    },
    elements: nextElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  editor.setState({}, () => {
    // actionFinalize after all state values have been updated
    editor.actionManager.executeAction(actionFinalize);
  });
};

export const onImageToolbarButtonClick = async (
  editor: CaliburnEditorComponent,
) => {
  try {
    const clientX = editor.state.width / 2 + editor.state.offsetLeft;
    const clientY = editor.state.height / 2 + editor.state.offsetTop;

    const { x, y } = viewportCoordsToSceneCoords(
      { clientX, clientY },
      editor.state,
    );

    const imageFiles = await fileOpen({
      description: "Image",
      extensions: Object.keys(
        IMAGE_MIME_TYPES,
      ) as (keyof typeof IMAGE_MIME_TYPES)[],
      multiple: true,
    });

    insertImages(editor, imageFiles, x, y);
  } catch (error: any) {
    if (error.name !== "AbortError") {
      console.error(error);
    } else {
      console.warn(error);
    }
    editor.setState(
      {
        newElement: null,
        activeTool: updateActiveTool(editor.state, {
          type: editor.state.preferredSelectionTool.type,
        }),
      },
      () => {
        editor.actionManager.executeAction(actionFinalize);
      },
    );
  }
};
