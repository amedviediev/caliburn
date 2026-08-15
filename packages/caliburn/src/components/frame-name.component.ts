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
import { getFrameLikeTitle } from "@excalidraw/element";

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

  protected frames() {
    this.host.changeGeneration();
    return this.host.scene.getNonDeletedFramesLikes();
  }

  protected title(frame: ExcalidrawFrameLikeElement) {
    return getFrameLikeTitle(frame);
  }

  protected labelStyle(frame: ExcalidrawFrameLikeElement) {
    const state = this.state();
    const isDarkTheme = state.theme === THEME.DARK;
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
      maxWidth: `${frame.width * state.zoom.value}px`,
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
