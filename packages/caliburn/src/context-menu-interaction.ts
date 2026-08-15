import {
  POINTER_BUTTON,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  LinearElementEditor,
  isLinearElement,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import { trackEvent } from "@excalidraw/excalidraw/analytics";

import type { Action } from "@excalidraw/excalidraw/actions/types";

import { actionAddToLibrary } from "./actions/actionAddToLibrary";
import {
  actionBindText,
  actionUnbindText,
  actionWrapTextInContainer,
} from "./actions/actionBoundText";
import {
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  actionCut,
  actionPaste,
  copyText,
} from "./actions/actionClipboard";
import { actionToggleCropEditor } from "./actions/actionCropEditor";
import { actionDeleteSelected } from "./actions/actionDeleteSelected";
import { actionDuplicateSelection } from "./actions/actionDuplicateSelection";
import {
  actionToggleElementLock,
  actionUnlockAllElements,
} from "./actions/actionElementLock";
import { actionCopyElementLink } from "./actions/actionElementLink";
import { actionFlipHorizontal, actionFlipVertical } from "./actions/actionFlip";
import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionWrapSelectionInFrame,
} from "./actions/actionFrame";
import { actionGroup, actionUngroup } from "./actions/actionGroup";
import { actionToggleLinearEditor } from "./actions/actionLinearEditor";
import { actionLink } from "./actions/actionLink";
import { actionSelectAll } from "./actions/actionSelectAll";
import { actionCopyStyles, actionPasteStyles } from "./actions/actionStyles";
import { actionTextAutoResize } from "./actions/actionTextAutoResize";
import { actionToggleArrowBinding } from "./actions/actionToggleArrowBinding";
import { actionToggleGridMode } from "./actions/actionToggleGridMode";
import { actionToggleMidpointSnapping } from "./actions/actionToggleMidpointSnapping";
import { actionToggleObjectsSnapMode } from "./actions/actionToggleObjectsSnapMode";
import { actionToggleStats } from "./actions/actionToggleStats";
import { actionToggleViewMode } from "./actions/actionToggleViewMode";
import { actionToggleZenMode } from "./actions/actionToggleZenMode";
import {
  actionBringForward,
  actionBringToFront,
  actionSendBackward,
  actionSendToBack,
} from "./actions/actionZindex";
import {
  getElementAtPosition,
  isHittingCommonBoundingBoxOfSelectedElements,
} from "./selection-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

export const CONTEXT_MENU_SEPARATOR = "separator" as const;

export type ContextMenuItem = typeof CONTEXT_MENU_SEPARATOR | Action;

/** Upstream `App.getContextMenuItems`. */
const getContextMenuItems = (
  editor: CaliburnEditorComponent,
  type: "canvas" | "element",
): ContextMenuItem[] => {
  const options: ContextMenuItem[] = [];

  options.push(actionCopyAsPng, actionCopyAsSvg);

  // canvas contextMenu
  // ---------------------------------------------------------------------------

  if (type === "canvas") {
    if (editor.state.viewModeEnabled) {
      return [
        ...options,
        actionToggleGridMode,
        actionToggleZenMode,
        actionToggleViewMode,
        actionToggleStats,
      ];
    }

    return [
      actionPaste,
      CONTEXT_MENU_SEPARATOR,
      actionCopyAsPng,
      actionCopyAsSvg,
      copyText,
      CONTEXT_MENU_SEPARATOR,
      actionSelectAll,
      actionUnlockAllElements,
      CONTEXT_MENU_SEPARATOR,
      actionToggleGridMode,
      actionToggleObjectsSnapMode,
      actionToggleArrowBinding,
      actionToggleMidpointSnapping,
      actionToggleZenMode,
      actionToggleViewMode,
      actionToggleStats,
    ];
  }

  // element contextMenu
  // ---------------------------------------------------------------------------

  options.push(copyText);

  if (editor.state.viewModeEnabled) {
    return [actionCopy, ...options];
  }

  const zIndexActions: ContextMenuItem[] =
    editor.editorInterface.formFactor === "desktop"
      ? [
          CONTEXT_MENU_SEPARATOR,
          actionSendBackward,
          actionBringForward,
          actionSendToBack,
          actionBringToFront,
        ]
      : [];

  return [
    CONTEXT_MENU_SEPARATOR,
    actionCut,
    actionCopy,
    actionPaste,
    CONTEXT_MENU_SEPARATOR,
    actionSelectAllElementsInFrame,
    actionRemoveAllElementsFromFrame,
    actionWrapSelectionInFrame,
    CONTEXT_MENU_SEPARATOR,
    actionToggleCropEditor,
    CONTEXT_MENU_SEPARATOR,
    ...options,
    CONTEXT_MENU_SEPARATOR,
    actionCopyStyles,
    actionPasteStyles,
    CONTEXT_MENU_SEPARATOR,
    actionGroup,
    actionTextAutoResize,
    actionUnbindText,
    actionBindText,
    actionWrapTextInContainer,
    actionUngroup,
    CONTEXT_MENU_SEPARATOR,
    actionAddToLibrary,
    ...zIndexActions,
    CONTEXT_MENU_SEPARATOR,
    actionFlipHorizontal,
    actionFlipVertical,
    CONTEXT_MENU_SEPARATOR,
    actionToggleLinearEditor,
    CONTEXT_MENU_SEPARATOR,
    actionLink,
    actionCopyElementLink,
    CONTEXT_MENU_SEPARATOR,
    actionDuplicateSelection,
    actionToggleElementLock,
    CONTEXT_MENU_SEPARATOR,
    actionDeleteSelected,
  ];
};

export const handleCanvasContextMenu = (
  editor: CaliburnEditorComponent,
  event: MouseEvent,
) => {
  // Always suppress the native menu over the canvas. In non-interactive
  // mode we stop here so it cannot be mistaken for Excalidraw's own menu.
  event.preventDefault();
  if (!editor.isInteractionEnabled()) {
    return;
  }

  if (
    "pointerType" in event &&
    (event as PointerEvent).pointerType === "pen" &&
    // always allow if user uses a pen secondary button
    event.button !== POINTER_BUTTON.SECONDARY &&
    editor.state.activeTool.type !== editor.state.preferredSelectionTool.type
  ) {
    return;
  }

  const { x, y } = viewportCoordsToSceneCoords(event, editor.state);
  const element = getElementAtPosition(editor, x, y, {
    preferSelected: true,
    includeLockedElements: true,
  });

  const selectedElements = editor.scene.getSelectedElements(editor.state);
  const isHittingCommonBoundBox = isHittingCommonBoundingBoxOfSelectedElements(
    editor,
    { x, y },
    selectedElements,
  );

  const type = element || isHittingCommonBoundBox ? "element" : "canvas";

  const container = editor.containerRef()?.nativeElement;
  const { top: offsetTop, left: offsetLeft } = container
    ? container.getBoundingClientRect()
    : { top: 0, left: 0 };
  const left = event.clientX - offsetLeft;
  const top = event.clientY - offsetTop;

  trackEvent("contextMenu", "openContextMenu", type);

  editor.setState(
    {
      ...(element && !editor.state.selectedElementIds[element.id]
        ? {
            ...editor.state,
            ...selectGroupsForSelectedElements(
              {
                editingGroupId: editor.state.editingGroupId,
                selectedElementIds: { [element.id]: true },
              },
              editor.scene.getNonDeletedElements(),
              editor.state,
              editor as any,
            ),
            selectedLinearElement: isLinearElement(element)
              ? new LinearElementEditor(
                  element,
                  editor.scene.getNonDeletedElementsMap(),
                )
              : null,
          }
        : editor.state),
      showHyperlinkPopup: false,
    },
    () => {
      editor.setState({
        contextMenu: {
          top,
          left,
          items: getContextMenuItems(editor, type),
        },
      });
    },
  );
};
