import {
  DEFAULT_VERTICAL_ALIGN,
  DOUBLE_TAP_POSITION_THRESHOLD,
  KEYS,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  VERTICAL_ALIGN,
  getFontString,
  getLineHeight,
  isTransparent,
  sceneCoordsToViewportCoords,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  fixBindingsAfterDeletion,
  getApproxMinLineHeight,
  getApproxMinLineWidth,
  getBoundTextElement,
  getContainerCenter,
  getContainerElement,
  getElementAbsoluteCoords,
  getLineHeightInPx,
  getMinTextElementWidth,
  getSelectedGroupIdForElement,
  getSelectedGroupIds,
  hasBoundTextElement,
  hitElementItself,
  isArrowElement,
  isCursorInFrame,
  isElbowArrow,
  isFrameLikeElement,
  isIframeLikeElement,
  isImageElement,
  isLineElement,
  isLinearElement,
  isNonDeletedElement,
  isSimpleArrow,
  isTextBindableContainer,
  isTextElement,
  isValidTextContainer,
  makeNextSelectedElementIds,
  newElementWith,
  newTextElement,
  refreshTextDimensions,
  selectGroupsForSelectedElements,
  updateBoundElements,
} from "@excalidraw/element";
import { pointDistance, pointFrom } from "@excalidraw/math";

import type { Radians } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  NonDeleted,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { actionToggleLinearEditor } from "./actions/actionLinearEditor";
import {
  getElementAtPosition,
  getElementHitThreshold,
  getElementsAtPosition,
} from "./selection-interaction";
import { textWysiwyg } from "./wysiwyg/textWysiwyg";

import type { CaliburnEditorComponent } from "./editor.component";
import type { PointerDownState } from "./selection-interaction";

export const deselectElements = (editor: CaliburnEditorComponent) => {
  editor.setState({
    selectedElementIds: makeNextSelectedElementIds({}, editor.state),
    selectedGroupIds: {},
    editingGroupId: null,
    activeEmbeddable: null,
  });
};

/**
 * Whether a text element's content is still being authored.
 *
 * Creating a text reverts the tool to selection during pointerdown, so the
 * pointerup that follows looks like an ordinary canvas click and would
 * capture the still-empty element as a history entry of its own. Undo would
 * then rewind only the typing, restoring an invisible, zero-content element
 * (and, for an endpoint label, leaving the arrow bound to it) rather than
 * removing it. The editor's own submit captures the finished text instead,
 * so the whole create-and-type lands in a single entry.
 */
export const isEditingTextContent = (editor: CaliburnEditorComponent) => {
  return (
    !!editor.state.editingTextElement || isTextElement(editor.state.newElement)
  );
};

export const getSelectedTextElement = (
  editor: CaliburnEditorComponent,
  container?: ExcalidrawTextContainer | null,
): NonDeleted<ExcalidrawTextElement> | null => {
  const selectedElements = editor.scene.getSelectedElements(editor.state);

  if (selectedElements.length !== 1) {
    return null;
  }

  const selectedElement = selectedElements[0]!;

  if (isTextElement(selectedElement)) {
    return selectedElement;
  }

  if (!container) {
    return null;
  }

  return getBoundTextElement(
    selectedElement,
    editor.scene.getNonDeletedElementsMap(),
  ) as NonDeleted<ExcalidrawTextElement> | null;
};

export const getTextElementAtPosition = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
): NonDeleted<ExcalidrawTextElement> | null => {
  const element = getElementAtPosition(editor, x, y, {
    includeBoundTextElement: true,
  });
  if (element && isTextElement(element) && !element.isDeleted) {
    return element;
  }
  return null;
};

export const getTextBindableContainerAtPosition = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
) => {
  const elements = editor.scene.getNonDeletedElements();
  const selectedElements = editor.scene.getSelectedElements(editor.state);
  if (selectedElements.length === 1) {
    return isTextBindableContainer(selectedElements[0], false)
      ? selectedElements[0]
      : null;
  }
  let hitElement = null;
  // We need to do hit testing from front (end of the array) to back (beginning of the array)
  for (let index = elements.length - 1; index >= 0; --index) {
    if (elements[index].isDeleted) {
      continue;
    }
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(
      elements[index],
      editor.scene.getNonDeletedElementsMap(),
    );
    if (
      isArrowElement(elements[index]) &&
      hitElementItself({
        point: pointFrom(x, y),
        element: elements[index],
        elementsMap: editor.scene.getNonDeletedElementsMap(),
        threshold: getElementHitThreshold(editor, elements[index]),
      })
    ) {
      hitElement = elements[index];
      break;
    } else if (x1 < x && x < x2 && y1 < y && y < y2) {
      // to allow binding to containers within frames,
      // ignore frames in hit testing
      if (isFrameLikeElement(elements[index])) {
        continue;
      }

      hitElement = elements[index];
      break;
    }
  }

  return isTextBindableContainer(hitElement, false) ? hitElement : null;
};

export const getTextWysiwygSnappedToCenterPosition = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
  appState: AppState,
  container?: ExcalidrawTextContainer | null,
) => {
  if (container) {
    let elementCenterX = container.x + container.width / 2;
    let elementCenterY = container.y + container.height / 2;

    const elementCenter = getContainerCenter(
      container,
      editor.scene.getNonDeletedElementsMap(),
    );
    if (elementCenter) {
      elementCenterX = elementCenter.x;
      elementCenterY = elementCenter.y;
    }
    const distanceToCenter = Math.hypot(x - elementCenterX, y - elementCenterY);
    const isSnappedToCenter = distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
    if (isSnappedToCenter) {
      const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
        { sceneX: elementCenterX, sceneY: elementCenterY },
        appState,
      );
      return { viewportX, viewportY, elementCenterX, elementCenterY };
    }
  }
};

export const getTextCreationGridPoint = (
  editor: CaliburnEditorComponent,
  x: number,
  y: number,
) => {
  const effectiveGridSize = editor.getEffectiveGridSize();

  if (effectiveGridSize === null) {
    return null;
  }

  const getTextCreationGridCoordinate = (coordinate: number) => {
    const topLeftGridPoint =
      Math.floor(coordinate / effectiveGridSize) * effectiveGridSize;

    return topLeftGridPoint;
  };

  return {
    x: getTextCreationGridCoordinate(x),
    y: getTextCreationGridCoordinate(y),
  };
};

export const getTopLayerFrameAtSceneCoords = (
  editor: CaliburnEditorComponent,
  /**
   * should be already grid aligned (basically should be what the call site
   * sets the element's coords to, if applicable)
   */
  sceneCoords: {
    x: number;
    y: number;
  },
  opts?: {
    /** to exclude selected elements when dragging, etc. */
    excludeElementIds?: AppState["selectedElementIds"];
    currentFrameId?: ExcalidrawElement["frameId"];
  },
) => {
  const elementsMap = editor.scene.getNonDeletedElementsMap();
  const framesUnderCursor = editor.scene
    .getNonDeletedFramesLikes()
    .filter(
      (frame) =>
        !frame.locked && isCursorInFrame(sceneCoords, frame, elementsMap),
    );

  if (!framesUnderCursor.length) {
    return null;
  }

  const topLayerFrame = framesUnderCursor.at(-1)!;

  const hitElement = getElementsAtPosition(
    editor,
    sceneCoords.x,
    sceneCoords.y,
    {
      includeLockedElements: true,
    },
  ).findLast((element) => !opts?.excludeElementIds?.[element.id]);

  if (hitElement) {
    if (
      isFrameLikeElement(hitElement) &&
      // case: we're hitting a locked frame itself (frame's outline
      // or later its bg once implemented)
      !hitElement.locked
    ) {
      return topLayerFrame;
    }

    const hitElementIndex = editor.scene.getElementIndex(hitElement.id);
    const topLayerFrameIndex = editor.scene.getElementIndex(topLayerFrame.id);

    if (
      hitElementIndex !== -1 &&
      topLayerFrameIndex !== -1 &&
      hitElementIndex <= topLayerFrameIndex
    ) {
      return topLayerFrame;
    }

    // to support a case of dragging a pre-existing frame child underneath
    // a non-frame element covering the cursor
    const currentFrame = opts?.currentFrameId
      ? framesUnderCursor.find((frame) => frame.id === opts.currentFrameId) ??
        null
      : null;

    if (currentFrame) {
      return currentFrame;
    }

    return hitElement.frameId
      ? framesUnderCursor.find((frame) => frame.id === hitElement.frameId) ??
          null
      : null;
  }

  return topLayerFrame;
};

export const handleTextWysiwyg = (
  editor: CaliburnEditorComponent,
  element: NonDeleted<ExcalidrawTextElement>,
  {
    isExistingElement = false,
    initialCaretSceneCoords = null,
  }: {
    isExistingElement?: boolean;
    /**
     * supply null if no caret positioning is desired, and instead
     * text should be auto-selected
     */
    initialCaretSceneCoords?: { x: number; y: number } | null;
  },
) => {
  const elementsMap = editor.scene.getElementsMapIncludingDeleted();

  const updateElement = (nextOriginalText: string, isDeleted: boolean) => {
    editor.scene.replaceAllElements([
      // Not sure why we include deleted elements as well hence using deleted elements map
      ...editor.scene.getElementsIncludingDeleted().map((_element) => {
        if (_element.id === element.id && isTextElement(_element)) {
          return newElementWith(_element, {
            originalText: nextOriginalText,
            isDeleted: isDeleted ?? _element.isDeleted,
            // returns (wrapped) text and new dimensions
            ...refreshTextDimensions(
              _element,
              getContainerElement(_element, elementsMap),
              elementsMap,
              nextOriginalText,
            ),
          });
        }
        return _element;
      }),
    ]);
  };

  editor.textWysiwygSubmitHandler = textWysiwyg({
    canvas: editor.canvas,
    getViewportCoords: (x, y) => {
      const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
        {
          sceneX: x,
          sceneY: y,
        },
        editor.state,
      );
      return [
        viewportX - editor.state.offsetLeft,
        viewportY - editor.state.offsetTop,
      ];
    },
    onChange: (nextOriginalText) => {
      updateElement(nextOriginalText, false);
      if (isNonDeletedElement(element)) {
        updateBoundElements(element, editor.scene);
      }
    },
    onSubmit: ({ viaKeyboard, nextOriginalText }) => {
      editor.textWysiwygSubmitHandler = null;

      const isDeleted = !nextOriginalText.trim();
      updateElement(nextOriginalText, isDeleted);

      // keyboard-submit keeps focus on the edited object. For bound text, keep
      // the container selected even if the text becomes empty and is deleted.
      // The autoshape tool stays active through the editing session and never
      // selects anything — don't fight the finalize action's selection reset.
      const elementIdToSelect =
        viaKeyboard &&
        !editor.isToolLocked() &&
        editor.state.activeTool.type !== "autoshape"
          ? element.containerId || (!isDeleted ? element.id : null)
          : null;

      if (elementIdToSelect) {
        // needed to ensure state is updated before "finalize" action
        // that's invoked on keyboard-submit as well
        // TODO either move this into finalize as well, or handle all state
        // updates in one place, skipping finalize action
        editor.setState((prevState) => ({
          selectedElementIds: makeNextSelectedElementIds(
            {
              ...prevState.selectedElementIds,
              [elementIdToSelect]: true,
            },
            prevState,
          ),
        }));
      }

      if (isDeleted) {
        fixBindingsAfterDeletion(editor.scene.getNonDeletedElements(), [
          element,
        ]);
      }

      if (!isDeleted || isExistingElement) {
        editor.store.scheduleCapture();
      }

      editor.setState({
        newElement: null,
        editingTextElement: null,
      });

      // tools that survive the submit (locked, or autoshape's
      // double-click-to-type flow) need their cursor back
      if (
        editor.isToolLocked() ||
        editor.state.activeTool.type === "autoshape"
      ) {
        editor.cursor.applyForTool();
      }

      editor.focusContainer();
    },
    element,
    excalidrawContainer: editor.containerRef()?.nativeElement ?? null,
    app: editor,
    initialCaretSceneCoords,
    // when text is selected, it's hard (at least on iOS) to re-position the
    // caret (i.e. deselect). There's not much use for always selecting
    // the text on edit anyway (and users can select-all from contextmenu
    // if needed)
    autoSelect: !editor.editorInterface.isTouchScreen,
  });
  // deselect all other elements when inserting text
  deselectElements(editor);

  // do an initial update to re-initialize element position since we were
  // modifying element's x/y for sake of editor (case: syncing to remote)
  updateElement(element.originalText, false);
};

export const startTextEditing = (
  editor: CaliburnEditorComponent,
  {
    sceneX,
    sceneY,
    insertAtParentCenter = true,
    container,
    autoEdit = true,
    initialCaretSceneCoords,
  }: {
    /** X position to insert text at */
    sceneX: number;
    /** Y position to insert text at */
    sceneY: number;
    /** whether to attempt to insert at element center if applicable */
    insertAtParentCenter?: boolean;
    container?: ExcalidrawTextContainer | null;
    autoEdit?: boolean;
    initialCaretSceneCoords?: { x: number; y: number };
  },
) => {
  let shouldBindToContainer = false;

  let parentCenterPosition =
    insertAtParentCenter &&
    getTextWysiwygSnappedToCenterPosition(
      editor,
      sceneX,
      sceneY,
      editor.state,
      container,
    );
  if (container && parentCenterPosition) {
    const boundTextElementToContainer = getBoundTextElement(
      container,
      editor.scene.getNonDeletedElementsMap(),
    );
    if (!boundTextElementToContainer) {
      shouldBindToContainer = true;
    }
  }
  const existingTextElement =
    getSelectedTextElement(editor, container) ||
    getTextElementAtPosition(editor, sceneX, sceneY);

  const fontFamily =
    existingTextElement?.fontFamily || editor.state.currentItemFontFamily;

  const lineHeight =
    existingTextElement?.lineHeight || getLineHeight(fontFamily);
  const fontSize = editor.state.currentItemFontSize;

  if (
    !existingTextElement &&
    shouldBindToContainer &&
    container &&
    !isArrowElement(container)
  ) {
    const fontString = {
      fontSize,
      fontFamily,
    };
    const minWidth = getApproxMinLineWidth(
      getFontString(fontString),
      lineHeight,
    );
    const minHeight = getApproxMinLineHeight(fontSize, lineHeight);
    const newHeight = Math.max(container.height, minHeight);
    const newWidth = Math.max(container.width, minWidth);
    editor.scene.mutateElement(container, {
      height: newHeight,
      width: newWidth,
    });
    sceneX = container.x + newWidth / 2;
    sceneY = container.y + newHeight / 2;
    if (parentCenterPosition) {
      parentCenterPosition = getTextWysiwygSnappedToCenterPosition(
        editor,
        sceneX,
        sceneY,
        editor.state,
        container,
      );
    }
  }

  const textCreationGridPoint = getTextCreationGridPoint(
    editor,
    sceneX,
    sceneY,
  );

  const newTextElementPosition = parentCenterPosition
    ? {
        x: parentCenterPosition.elementCenterX,
        y: parentCenterPosition.elementCenterY,
      }
    : !existingTextElement
    ? {
        x: textCreationGridPoint?.x ?? sceneX,
        y:
          textCreationGridPoint === null
            ? // Free text starts from a point cursor, so center the first line box on it.
              sceneY - getLineHeightInPx(fontSize, lineHeight) / 2
            : textCreationGridPoint.y,
      }
    : {
        x: sceneX,
        y: sceneY,
      };

  const topLayerFrame = getTopLayerFrameAtSceneCoords(editor, {
    x: newTextElementPosition.x,
    y: newTextElementPosition.y,
  });

  // container has higher priority. Only add to frame if container is in the same frame.
  const frameId =
    topLayerFrame &&
    (!shouldBindToContainer ||
      !container ||
      container.frameId === topLayerFrame.id)
      ? topLayerFrame.id
      : null;

  const element =
    existingTextElement ||
    newTextElement({
      x: newTextElementPosition.x,
      y: newTextElementPosition.y,
      strokeColor: editor.state.currentItemStrokeColor,
      backgroundColor: editor.state.currentItemBackgroundColor,
      fillStyle: editor.state.currentItemFillStyle,
      strokeWidth: editor.getCurrentItemStrokeWidth("text"),
      strokeStyle: editor.state.currentItemStrokeStyle,
      roughness: editor.state.currentItemRoughness,
      opacity: editor.state.currentItemOpacity,
      text: "",
      fontSize,
      fontFamily,
      textAlign: parentCenterPosition
        ? "center"
        : editor.state.currentItemTextAlign,
      verticalAlign: parentCenterPosition
        ? VERTICAL_ALIGN.MIDDLE
        : DEFAULT_VERTICAL_ALIGN,
      containerId: shouldBindToContainer ? container?.id : undefined,
      groupIds: container?.groupIds ?? [],
      lineHeight,
      angle: container
        ? isArrowElement(container)
          ? (0 as Radians)
          : container.angle
        : (0 as Radians),
      frameId,
    });

  if (!existingTextElement && shouldBindToContainer && container) {
    editor.scene.mutateElement(container, {
      boundElements: (container.boundElements || []).concat({
        type: "text",
        id: element.id,
      }),
    });
  }
  editor.setState({ editingTextElement: element });

  if (!existingTextElement) {
    if (container && shouldBindToContainer) {
      const containerIndex = editor.scene.getElementIndex(container.id);
      // TODO should use insertNewElement, after we update it to handle
      // elements with containerId + frameId at the same time (containerId
      // should take precedence when it comes to z-index)
      editor.scene.insertElementsAtIndex([element], containerIndex + 1);
    } else {
      editor.insertNewElement(element);
    }
  }

  if (autoEdit || existingTextElement || container) {
    handleTextWysiwyg(editor, element, {
      isExistingElement: !!existingTextElement,
      initialCaretSceneCoords: existingTextElement
        ? initialCaretSceneCoords
        : null,
    });
  } else {
    editor.setState({
      newElement: element,
      multiElement: null,
    });
  }
};

export const handleTextOnPointerDown = (
  editor: CaliburnEditorComponent,
  event: PointerEvent,
  pointerDownState: PointerDownState,
): void => {
  // if we're currently still editing text, clicking outside
  // should only finalize it, not create another (irrespective
  // of state.activeTool.locked)
  if (editor.state.editingTextElement) {
    return;
  }
  let sceneX = pointerDownState.origin.x;
  let sceneY = pointerDownState.origin.y;

  // the click transitions into text editing either way, consuming (or
  // bypassing) whatever anchor was highlighted — don't leave it lingering
  // under the editor, which outlives the hover when the tool is locked
  editor.setState({ hoveredArrowTextAnchor: null });

  const element = getElementAtPosition(editor, sceneX, sceneY, {
    includeBoundTextElement: true,
  });

  // FIXME
  let container = getTextBindableContainerAtPosition(editor, sceneX, sceneY);

  if (hasBoundTextElement(element)) {
    container = element as NonDeleted<ExcalidrawTextContainer>;
    sceneX = element.x + element.width / 2;
    sceneY = element.y + element.height / 2;
  }
  startTextEditing(editor, {
    sceneX,
    sceneY,
    insertAtParentCenter: !event.altKey,
    container,
    autoEdit: false,
    initialCaretSceneCoords: { x: sceneX, y: sceneY },
  });

  if (!editor.isToolLocked()) {
    editor.setState(
      {
        activeTool: updateActiveTool(editor.state, {
          type: editor.state.preferredSelectionTool.type,
        }),
      },
      // reset once the tool revert has settled
      () => editor.cursor.reset(),
    );
  } else {
    editor.cursor.reset();
  }
};

export const handleTextElementOnPointerUp = (
  editor: CaliburnEditorComponent,
  newElement: NonDeleted<ExcalidrawTextElement>,
) => {
  const minWidth = getMinTextElementWidth(
    getFontString({
      fontSize: newElement.fontSize,
      fontFamily: newElement.fontFamily,
    }),
    newElement.lineHeight,
  );

  if (newElement.width < minWidth) {
    editor.scene.mutateElement(newElement, {
      autoResize: true,
    });
  }

  editor.cursor.reset();

  handleTextWysiwyg(editor, newElement, {
    isExistingElement: true,
  });

  // upstream's pointer-up tail always clears `newElement` once the
  // interaction ends — without this, the next click's pointer-up would
  // treat the element as still-being-created and open a second editor
  if (!editor.isToolLocked()) {
    editor.setState(
      {
        newElement: null,
        suggestedBinding: null,
        activeTool: updateActiveTool(editor.state, {
          type: editor.state.preferredSelectionTool.type,
        }),
      },
      () => editor.cursor.reset(),
    );
  } else {
    editor.setState({
      newElement: null,
      suggestedBinding: null,
    });
  }
};

export const getSelectedTextEditingContainerAtPosition = (
  editor: CaliburnEditorComponent,
  hitElement: NonDeleted<ExcalidrawElement> | null,
  sceneCoords: { x: number; y: number },
): ExcalidrawTextContainer | null | undefined => {
  const selectedElements = editor.scene.getSelectedElements(editor.state);

  if (
    selectedElements.length !== 1 ||
    !hitElement ||
    hitElement.id !== selectedElements[0]!.id
  ) {
    return null;
  }

  const selectedElement = selectedElements[0]!;

  if (isTextElement(selectedElement)) {
    return null;
  }

  if (!isValidTextContainer(selectedElement)) {
    return undefined;
  }

  const textElement = getSelectedTextElement(editor, selectedElement);
  const hitTextElement = getTextElementAtPosition(
    editor,
    sceneCoords.x,
    sceneCoords.y,
  );

  if (!textElement || hitTextElement?.id !== textElement.id) {
    return undefined;
  }

  return selectedElement;
};

export const maybeStartTextEditingOnPointerUp = (
  editor: CaliburnEditorComponent,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): boolean => {
  const hitElement = pointerDownState.hit.element;
  const sceneCoords = viewportCoordsToSceneCoords(
    { clientX: event.clientX, clientY: event.clientY },
    editor.state,
  );

  const selectedTextEditingContainer =
    getSelectedTextEditingContainerAtPosition(editor, hitElement, sceneCoords);

  if (
    editor.state.activeTool.type === editor.state.preferredSelectionTool.type &&
    !editor.state.editingTextElement &&
    !pointerDownState.drag.hasOccurred &&
    !pointerDownState.hit.wasAddedToSelection &&
    !event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD] &&
    !event.altKey &&
    event.pointerType !== "touch" &&
    hitElement &&
    ((isTextElement(hitElement) &&
      editor.state.selectedElementIds[hitElement.id] &&
      editor.scene.getSelectedElements(editor.state).length === 1) ||
      selectedTextEditingContainer)
  ) {
    startTextEditing(editor, {
      sceneX: sceneCoords.x,
      sceneY: sceneCoords.y,
      container: selectedTextEditingContainer,
      initialCaretSceneCoords: editor.lastPointerUpIsDoubleClick
        ? undefined
        : sceneCoords,
    });
    return true;
  }
  return false;
};

export const startImageCropping = (
  editor: CaliburnEditorComponent,
  image: ExcalidrawImageElement,
) => {
  editor.store.scheduleCapture();
  editor.setState({
    croppingElementId: image.id,
  });
};

const shouldHandleBrowserCanvasDoubleClick = (
  editor: CaliburnEditorComponent,
  type: string,
) => {
  // TODO remove this once we consolidate double-click logic and handle
  // ourselves for all event types together
  if (type === "touch") {
    return true;
  }
  if (editor.lastCompletedCanvasClicks.length === 0) {
    return true;
  }

  if (editor.lastCompletedCanvasClicks.length < 2) {
    return false;
  }

  const [firstClick, secondClick] = editor.lastCompletedCanvasClicks;

  return (
    pointDistance(
      pointFrom(firstClick.x, firstClick.y),
      pointFrom(secondClick.x, secondClick.y),
    ) <= DOUBLE_TAP_POSITION_THRESHOLD
  );
};

export const handleCanvasDoubleClick = (
  editor: CaliburnEditorComponent,
  event: MouseEvent,
) => {
  if (
    !editor.isInteractionEnabled() ||
    editor.state.editingTextElement ||
    !shouldHandleBrowserCanvasDoubleClick(editor, event.type)
  ) {
    return;
  }
  // case: double-clicking with arrow/line tool selected would both create
  // text and enter multiElement mode
  if (editor.state.multiElement) {
    return;
  }
  // double click only creates/edits text in selection mode, or with the
  // autoshape tool (double-click-to-type without leaving the tool; all the
  // selection-dependent branches below are inert there since autoshape
  // never selects anything)
  if (
    editor.state.activeTool.type !== editor.state.preferredSelectionTool.type &&
    editor.state.activeTool.type !== "autoshape"
  ) {
    return;
  }

  const selectedElements = editor.scene.getSelectedElements(editor.state);

  let { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    event,
    editor.state,
  );

  if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
    const selectedLinearElement: ExcalidrawLinearElement = selectedElements[0];

    if (
      ((event[KEYS.CTRL_OR_CMD] && isSimpleArrow(selectedLinearElement)) ||
        isLineElement(selectedLinearElement)) &&
      (!editor.state.selectedLinearElement?.isEditing ||
        editor.state.selectedLinearElement.elementId !==
          selectedLinearElement.id)
    ) {
      // Use the proper action to ensure immediate history capture
      editor.actionManager.executeAction(actionToggleLinearEditor);
      return;
    } else if (
      editor.state.selectedLinearElement?.isEditing &&
      editor.state.selectedLinearElement.elementId ===
        selectedLinearElement.id &&
      isLineElement(selectedLinearElement)
    ) {
      return;
    }
  }

  if (selectedElements.length === 1 && isImageElement(selectedElements[0])) {
    startImageCropping(editor, selectedElements[0]);
    return;
  }

  editor.cursor.reset();

  const selectedGroupIds = getSelectedGroupIds(editor.state);

  if (selectedGroupIds.length > 0) {
    const hitElement = getElementAtPosition(editor, sceneX, sceneY);

    const selectedGroupId =
      hitElement &&
      getSelectedGroupIdForElement(hitElement, editor.state.selectedGroupIds);

    if (selectedGroupId) {
      editor.store.scheduleCapture();
      editor.setState((prevState) => ({
        ...prevState,
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: selectedGroupId,
            selectedElementIds: { [hitElement!.id]: true },
          },
          editor.scene.getNonDeletedElements(),
          prevState,
          editor as any,
        ),
      }));
      return;
    }
  }

  editor.cursor.reset();
  if (!editor.state.viewModeEnabled) {
    const hitElement = getElementAtPosition(editor, sceneX, sceneY);

    if (isIframeLikeElement(hitElement)) {
      editor.setState({
        activeEmbeddable: { element: hitElement, state: "active" },
      });
      return;
    }

    // shouldn't edit/create text when inside line editor (often false positive)

    if (!editor.state.selectedLinearElement?.isEditing) {
      const container =
        // skip binding to container on dblclick when holding ctrl
        !event[KEYS.CTRL_OR_CMD] &&
        getTextBindableContainerAtPosition(editor, sceneX, sceneY);

      if (container) {
        if (
          // with autoshape, any hit inside a bindable shape means "type in
          // this shape" — unlike selection mode, a transparent unfilled
          // container binds even when its stroke wasn't hit (Alt keeps the
          // free-text-at-point escape hatch)
          editor.state.activeTool.type === "autoshape" ||
          hasBoundTextElement(container) ||
          !isTransparent(container.backgroundColor) ||
          hitElementItself({
            point: pointFrom(sceneX, sceneY),
            element: container,
            elementsMap: editor.scene.getNonDeletedElementsMap(),
            threshold: getElementHitThreshold(editor, container),
          })
        ) {
          const midPoint = getContainerCenter(
            container,
            editor.scene.getNonDeletedElementsMap(),
          );

          sceneX = midPoint.x;
          sceneY = midPoint.y;
        }
      }

      startTextEditing(editor, {
        sceneX,
        sceneY,
        insertAtParentCenter: !event.altKey,
        container: container || null,
      });
    }
  }
};

export const handleEnterToEditKeyDown = (
  editor: CaliburnEditorComponent,
  event: KeyboardEvent,
): boolean => {
  const selectedElements = editor.scene.getSelectedElements(editor.state);
  if (selectedElements.length !== 1) {
    return false;
  }
  const selectedElement = selectedElements[0];
  if (event[KEYS.CTRL_OR_CMD] || isLineElement(selectedElement)) {
    if (isLinearElement(selectedElement)) {
      if (
        !editor.state.selectedLinearElement?.isEditing ||
        editor.state.selectedLinearElement.elementId !== selectedElement.id
      ) {
        editor.store.scheduleCapture();
        if (!isElbowArrow(selectedElement)) {
          editor.actionManager.executeAction(actionToggleLinearEditor);
        }
      }
    }
  } else if (
    isTextElement(selectedElement) ||
    isValidTextContainer(selectedElement)
  ) {
    let container;
    if (!isTextElement(selectedElement)) {
      container = selectedElement as ExcalidrawTextContainer;
    }
    const midPoint = getContainerCenter(
      selectedElement,
      editor.scene.getNonDeletedElementsMap(),
    );
    const sceneX = midPoint.x;
    const sceneY = midPoint.y;
    startTextEditing(editor, {
      sceneX,
      sceneY,
      container,
    });
    event.preventDefault();
    return true;
  } else if (isFrameLikeElement(selectedElement)) {
    editor.setState({
      editingFrame: selectedElement.id,
    });
  }
  return false;
};
