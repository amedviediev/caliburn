import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  inject,
  viewChild,
} from "@angular/core";

import {
  CLASSES,
  CURSOR_TYPE,
  FRAME_STYLE,
  KEYS,
  POINTER_EVENTS,
  THEME,
  applyDarkModeFilter,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";
import {
  getFrameLikeTitle,
  isElementInViewport,
  isFrameLikeElement,
} from "@excalidraw/element";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import { resetEditingFrame } from "../frame-interaction";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import type { ElementRef } from "@angular/core";

import type { CaliburnEditorComponent } from "../editor.component";

const FRAME_NAME_EDIT_PADDING = 6;

/**
 * Angular port of upstream `App.tsx`'s `renderFrameNames`: the DOM overlay
 * (`CLASSES.FRAME_NAME`) positioned above each frame, swapping to an input
 * on double click. Commit (trim, empty -> null) lives in `resetEditingFrame`
 * (`frame-interaction.ts`), shared with the view-mode-entry / interaction-
 * disabled commit paths in `editor.component.ts`.
 */
@Component({
  selector: "caliburn-frame-names",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./frame-name.component.html",
})
export class CaliburnFrameNameComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly editor = () => this.host;

  protected readonly frameNameClass = CLASSES.FRAME_NAME;

  private readonly frameNameInput =
    viewChild<ElementRef<HTMLInputElement>>("frameNameInput");

  constructor() {
    effect(() => {
      this.frameNameInput()?.nativeElement.focus();
    });
  }

  protected state() {
    this.host.changeGeneration();
    return this.host.state;
  }

  protected frames(): readonly ExcalidrawFrameLikeElement[] {
    this.host.changeGeneration();
    const state = this.host.state;

    if (!state.frameRendering.enabled || !state.frameRendering.name) {
      if (state.editingFrame) {
        this.commitEditingFrame(null);
      }
      return [];
    }

    return this.host.scene.getNonDeletedFramesLikes().filter((frame) => {
      if (
        !isElementInViewport(
          frame,
          this.host.canvas.width / window.devicePixelRatio,
          this.host.canvas.height / window.devicePixelRatio,
          {
            offsetLeft: state.offsetLeft,
            offsetTop: state.offsetTop,
            scrollX: state.scrollX,
            scrollY: state.scrollY,
            zoom: state.zoom,
          },
          this.host.scene.getNonDeletedElementsMap(),
        )
      ) {
        if (state.editingFrame === frame.id) {
          this.commitEditingFrame(frame);
        }
        // if frame not visible, don't render its name
        return false;
      }

      return true;
    });
  }

  /**
   * Upstream commits the in-flight name edit from inside `renderFrameNames`,
   * i.e. during render; here `frames()` is called from the template, where a
   * `setState` (which runs change detection) cannot re-enter, so the commit is
   * deferred by a microtask — the same way the view-mode-entry commit in
   * `editor.component.ts` is. Re-checked on the way out so only the edit that
   * was in flight when the label stopped rendering is the one committed.
   */
  private commitEditingFrame(frame: ExcalidrawFrameLikeElement | null) {
    const editingFrame = this.host.state.editingFrame;
    queueMicrotask(() => {
      if (this.host.state.editingFrame === editingFrame) {
        resetEditingFrame(this.host, frame);
      }
    });
  }

  /** upstream's `focusedSearchMatch` in `renderFrameNames` */
  private focusedSearchMatch() {
    const state = this.state();
    return state.searchMatches?.focusedId &&
      isFrameLikeElement(
        this.host.scene.getElement(state.searchMatches.focusedId),
      )
      ? state.searchMatches.matches.find((sm) => sm.focus)
      : null;
  }

  protected title(frame: ExcalidrawFrameLikeElement) {
    return getFrameLikeTitle(frame);
  }

  /** the id `App.frameNameBoundsCache` reads the label's box by */
  protected domId(frame: ExcalidrawFrameLikeElement) {
    return this.host.getFrameNameDOMId(frame);
  }

  protected labelStyle(frame: ExcalidrawFrameLikeElement) {
    const state = this.state();
    const isDarkTheme = state.theme === THEME.DARK;
    const focusedSearchMatch = this.focusedSearchMatch();
    const { x: x1, y: y1 } = sceneCoordsToViewportCoords(
      { sceneX: frame.x, sceneY: frame.y },
      state,
    );

    return {
      position: "absolute",
      bottom: `${
        state.height + FRAME_STYLE.nameOffsetY - y1 + state.offsetTop
      }px`,
      left: `${x1 - state.offsetLeft}px`,
      zIndex: "2",
      fontSize: `${FRAME_STYLE.nameFontSize}px`,
      color: isDarkTheme
        ? FRAME_STYLE.nameColorDarkTheme
        : FRAME_STYLE.nameColorLightTheme,
      lineHeight: `${FRAME_STYLE.nameLineHeight}`,
      width: "max-content",
      maxWidth:
        focusedSearchMatch?.id === frame.id && focusedSearchMatch?.focus
          ? "none"
          : `${frame.width * state.zoom.value}px`,
      overflow: frame.id === state.editingFrame ? "visible" : "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      cursor: CURSOR_TYPE.MOVE,
      pointerEvents: state.viewModeEnabled
        ? POINTER_EVENTS.disabled
        : POINTER_EVENTS.enabled,
    };
  }

  protected inputStyle(frame: ExcalidrawFrameLikeElement) {
    const state = this.state();
    const isDarkTheme = state.theme === THEME.DARK;
    const { x: x1 } = sceneCoordsToViewportCoords(
      { sceneX: frame.x, sceneY: frame.y },
      state,
    );

    return {
      background: applyDarkModeFilter(state.viewBackgroundColor, isDarkTheme),
      zIndex: "2",
      border: "none",
      display: "block",
      padding: `${FRAME_NAME_EDIT_PADDING}px`,
      borderRadius: "4px",
      boxShadow: "inset 0 0 0 1px var(--color-primary)",
      fontFamily: "Assistant",
      fontSize: `${FRAME_STYLE.nameFontSize}px`,
      transform: `translate(-${FRAME_NAME_EDIT_PADDING}px, ${FRAME_NAME_EDIT_PADDING}px)`,
      color: isDarkTheme
        ? FRAME_STYLE.nameColorDarkTheme
        : FRAME_STYLE.nameColorLightTheme,
      overflow: "hidden",
      maxWidth: `${document.body.clientWidth - x1 - FRAME_NAME_EDIT_PADDING}px`,
    };
  }

  protected startEditing(frame: ExcalidrawFrameLikeElement) {
    this.host.setState({ editingFrame: frame.id });
  }

  protected onInput(frame: ExcalidrawFrameLikeElement, event: Event) {
    this.host.scene.mutateElement(frame, {
      name: (event.target as HTMLInputElement).value,
    });
  }

  protected onFocus(event: FocusEvent) {
    (event.target as HTMLInputElement).select();
  }

  protected onKeydown(frame: ExcalidrawFrameLikeElement, event: KeyboardEvent) {
    if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      this.commitName(frame);
    }
  }

  protected commitName(frame: ExcalidrawFrameLikeElement) {
    resetEditingFrame(this.host, frame);
  }
}
