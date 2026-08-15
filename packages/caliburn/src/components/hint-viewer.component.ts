import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR } from "@excalidraw/common";

import {
  isArrowElement,
  isFlowchartNodeElement,
  isImageElement,
  isLinearElement,
  isLineElement,
  isNodeInFlowchart,
  isTextBindableContainer,
  isTextElement,
} from "@excalidraw/element";

import { isEraserActive } from "@excalidraw/excalidraw/appState";
import { t } from "@excalidraw/excalidraw/i18n";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";
import { isGridModeEnabled } from "@excalidraw/excalidraw/snapping";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import type { CaliburnEditorComponent } from "../editor.component";

const getTaggedShortcutKey = (key: string | string[]) =>
  Array.isArray(key)
    ? `<kbd>${key.map(getShortcutKey).join(" + ")}</kbd>`
    : `<kbd>${getShortcutKey(key)}</kbd>`;

/**
 * Port of upstream `HintViewer.tsx`'s `getHints` — the pure
 * state → hint-text function.
 */
const getHints = (
  editor: CaliburnEditorComponent,
  isMobile: boolean,
): null | string | string[] => {
  const appState = editor.state;
  const { activeTool, isResizing, isRotating, lastPointerDownWith } = appState;
  const multiMode = appState.multiElement !== null;

  if (
    appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
    appState.openSidebar.tab === CANVAS_SEARCH_TAB &&
    appState.searchMatches?.matches.length
  ) {
    return t("hints.dismissSearch", {
      shortcut: getTaggedShortcutKey("Escape"),
    });
  }

  if (appState.openSidebar && !editor.editorInterface.canFitSidebar) {
    return null;
  }

  if (isEraserActive(appState)) {
    return t("hints.eraserRevert", {
      shortcut: getTaggedShortcutKey("Alt"),
    });
  }

  const selectedElements = editor.scene.getSelectedElements(appState);

  // creating or dragging arrow point
  if (
    appState.selectedLinearElement?.isDragging &&
    selectedElements[0]?.type === "arrow"
  ) {
    return t("hints.arrowBindModifiers", {
      shortcut_1: getTaggedShortcutKey("Ctrl"),
      shortcut_2: getTaggedShortcutKey("Alt"),
    });
  }

  if (activeTool.type === "arrow" || activeTool.type === "line") {
    if (multiMode) {
      return t("hints.linearElementMulti", {
        shortcut_1: getTaggedShortcutKey("Escape"),
        shortcut_2: getTaggedShortcutKey("Enter"),
      });
    }
    if (activeTool.type === "arrow") {
      return t("hints.arrowTool", {
        shortcut: getTaggedShortcutKey("A"),
      });
    }
    return t("hints.linearElement");
  }

  if (activeTool.type === "freedraw") {
    return t("hints.freeDraw");
  }

  if (activeTool.type === "text") {
    return t("hints.text");
  }

  if (activeTool.type === "embeddable") {
    return t("hints.embeddable");
  }

  if (activeTool.type === "autoshape") {
    return t("hints.autoshape");
  }

  if (
    isResizing &&
    lastPointerDownWith === "mouse" &&
    selectedElements.length === 1
  ) {
    const targetElement = selectedElements[0];
    if (isLinearElement(targetElement) && targetElement.points.length === 2) {
      return t("hints.lockAngle", {
        shortcut: getTaggedShortcutKey("Shift"),
      });
    }
    return isImageElement(targetElement)
      ? t("hints.resizeImage", {
          shortcut_1: getTaggedShortcutKey("Shift"),
          shortcut_2: getTaggedShortcutKey("Alt"),
        })
      : t("hints.resize", {
          shortcut_1: getTaggedShortcutKey("Shift"),
          shortcut_2: getTaggedShortcutKey("Alt"),
        });
  }

  if (isRotating && lastPointerDownWith === "mouse") {
    return t("hints.rotate", {
      shortcut: getTaggedShortcutKey("Shift"),
    });
  }

  if (selectedElements.length === 1 && isTextElement(selectedElements[0])) {
    return t("hints.text_selected", {
      shortcut: getTaggedShortcutKey("Enter"),
    });
  }

  if (appState.editingTextElement) {
    return t("hints.text_editing", {
      shortcut_1: getTaggedShortcutKey("Escape"),
      shortcut_2: getTaggedShortcutKey(["CtrlOrCmd", "Enter"]),
    });
  }

  if (appState.croppingElementId) {
    return t("hints.leaveCropEditor", {
      shortcut_1: getTaggedShortcutKey("Enter"),
      shortcut_2: getTaggedShortcutKey("Escape"),
    });
  }

  if (selectedElements.length === 1 && isImageElement(selectedElements[0])) {
    return t("hints.enterCropEditor", {
      shortcut: getTaggedShortcutKey("Enter"),
    });
  }

  if (activeTool.type === "selection") {
    if (
      appState.selectionElement &&
      !selectedElements.length &&
      !appState.editingTextElement &&
      !appState.selectedLinearElement?.isEditing
    ) {
      return t("hints.deepBoxSelect", {
        shortcut: getTaggedShortcutKey("CtrlOrCmd"),
      });
    }

    if (
      isGridModeEnabled(editor as never) &&
      appState.selectedElementsAreBeingDragged
    ) {
      return t("hints.disableSnapping", {
        shortcut: getTaggedShortcutKey("CtrlOrCmd"),
      });
    }

    if (!selectedElements.length && !isMobile) {
      return t("hints.canvasPanning", {
        shortcut_1: getTaggedShortcutKey(t("keys.mmb")),
        shortcut_2: getTaggedShortcutKey("Space"),
      });
    }

    if (selectedElements.length === 1) {
      if (isLinearElement(selectedElements[0])) {
        if (
          isArrowElement(selectedElements[0]) &&
          appState.selectedLinearElement?.elementId ===
            selectedElements[0].id &&
          (appState.selectedLinearElement.hoverPointIndex === 0 ||
            appState.selectedLinearElement.hoverPointIndex ===
              selectedElements[0].points.length - 1)
        ) {
          return t("hints.toggleArrowhead");
        }
        if (appState.selectedLinearElement?.isEditing) {
          return appState.selectedLinearElement.selectedPointsIndices
            ? t("hints.lineEditor_pointSelected", {
                shortcut_1: getTaggedShortcutKey("Delete"),
                shortcut_2: getTaggedShortcutKey(["CtrlOrCmd", "D"]),
              })
            : t("hints.lineEditor_nothingSelected", {
                shortcut_1: getTaggedShortcutKey("Shift"),
                shortcut_2: getTaggedShortcutKey("Alt"),
              });
        }
        return isLineElement(selectedElements[0])
          ? t("hints.lineEditor_line_info", {
              shortcut: getTaggedShortcutKey("Enter"),
            })
          : t("hints.lineEditor_info", {
              shortcut_1: getTaggedShortcutKey("CtrlOrCmd"),
              shortcut_2: getTaggedShortcutKey(["CtrlOrCmd", "Enter"]),
            });
      }
      if (
        !appState.newElement &&
        !appState.selectedElementsAreBeingDragged &&
        isTextBindableContainer(selectedElements[0])
      ) {
        const bindTextToElement = t("hints.bindTextToElement", {
          shortcut: getTaggedShortcutKey("Enter"),
        });
        const createFlowchart = t("hints.createFlowchart", {
          shortcut: getTaggedShortcutKey(["CtrlOrCmd", "↑↓"]),
        });
        if (isFlowchartNodeElement(selectedElements[0])) {
          if (
            isNodeInFlowchart(
              selectedElements[0],
              editor.scene.getNonDeletedElementsMap(),
            )
          ) {
            return [bindTextToElement, createFlowchart];
          }

          return [bindTextToElement, createFlowchart];
        }

        return bindTextToElement;
      }
    }
  }

  return null;
};

type HintPart = { text: string; kbd: boolean };

/**
 * Angular port of upstream `HintViewer.tsx`. The `<kbd>`-tagged hint string
 * is split into parts here rather than into JSX. Host is `display: contents`
 * (see `styles.scss`) so the rendered `.HintViewer` sits directly inside the
 * toolbar island, as upstream.
 */
@Component({
  selector: "caliburn-hint-viewer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./hint-viewer.component.html",
})
export class CaliburnHintViewerComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  parts(): HintPart[] | null {
    this.editor.changeGeneration();

    const hints = getHints(
      this.editor,
      this.editor.editorInterface.formFactor === "phone",
    );

    if (!hints) {
      return null;
    }

    const hint = Array.isArray(hints)
      ? hints.map((hint) => hint.replace(/\. ?$/, "")).join(", ")
      : hints;

    return hint.split(/(<kbd>[^<]+<\/kbd>)/g).map((part, index) => {
      if (index % 2 === 1) {
        const shortcutMatch =
          part[0] === "<" && part.match(/^<kbd>([^<]+)<\/kbd>$/);
        return { text: shortcutMatch ? shortcutMatch[1] : part, kbd: true };
      }
      return { text: part, kbd: false };
    });
  }
}
