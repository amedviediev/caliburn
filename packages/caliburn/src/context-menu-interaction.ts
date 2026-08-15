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

import {
  actionBindText,
  actionUnbindText,
  actionWrapTextInContainer,
} from "./actions/actionBoundText";
import { actionCopy, actionCut, actionPaste } from "./actions/actionClipboard";
import { actionDeleteSelected } from "./actions/actionDeleteSelected";
import { actionDuplicateSelection } from "./actions/actionDuplicateSelection";
import {
  actionToggleElementLock,
  actionUnlockAllElements,
} from "./actions/actionElementLock";
import { actionFlipHorizontal, actionFlipVertical } from "./actions/actionFlip";
import { actionGroup, actionUngroup } from "./actions/actionGroup";
import { actionToggleLinearEditor } from "./actions/actionLinearEditor";
import { actionSelectAll } from "./actions/actionSelectAll";
import { actionTextAutoResize } from "./actions/actionTextAutoResize";
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

/**
 * Upstream `getContextMenuItems`, restricted to the actions Caliburn has
 * ported so far (export/style/frame/link menu entries arrive with their
 * actions). Order matches upstream.
 */
const getContextMenuItems = (
  editor: CaliburnEditorComponent,
  type: "canvas" | "element",
): ContextMenuItem[] => {
  // canvas contextMenu
  // ---------------------------------------------------------------------------

  if (type === "canvas") {
    if (editor.state.viewModeEnabled) {
      return [];
    }

    return [
      actionPaste,
      CONTEXT_MENU_SEPARATOR,
      actionSelectAll,
      actionUnlockAllElements,
    ];
  }

  // element contextMenu
  // ---------------------------------------------------------------------------

  if (editor.state.viewModeEnabled) {
    return [actionCopy];
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
    actionCut,
    actionCopy,
    actionPaste,
    CONTEXT_MENU_SEPARATOR,
    actionGroup,
    actionTextAutoResize,
    actionUnbindText,
    actionBindText,
    actionWrapTextInContainer,
    actionUngroup,
    ...zIndexActions,
    CONTEXT_MENU_SEPARATOR,
    actionFlipHorizontal,
    actionFlipVertical,
    CONTEXT_MENU_SEPARATOR,
    actionToggleLinearEditor,
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
