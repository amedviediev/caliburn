import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

import { pointFrom } from "@excalidraw/math";

import {
  EVENT,
  KEYS,
  isLocalLink,
  normalizeLink,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  wrapEvent,
} from "@excalidraw/common";
import {
  ShapeCache,
  embeddableURLValidator,
  getElementAbsoluteCoords,
  getEmbedLink,
  hitElementBoundingBox,
  isEmbeddableElement,
} from "@excalidraw/element";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { t } from "@excalidraw/excalidraw/i18n";

import type { GlobalPoint } from "@excalidraw/math";
import type {
  ElementsMap,
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { CaliburnIconButtonComponent } from "../icon-button.component";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { translated } from "../../i18n";

import type { CaliburnEditorComponent } from "../../editor.component";

import type { AfterViewInit, ElementRef, OnDestroy } from "@angular/core";

const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 42;
const POPUP_PADDING = 5;
const SPACE_BOTTOM = 85;
const AUTO_HIDE_TIMEOUT = 500;

const embeddableLinkCache = new Map<
  ExcalidrawEmbeddableElement["id"],
  string
>();

const getCoordsForPopover = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
) => {
  const [x1, y1] = getElementAbsoluteCoords(element, elementsMap);
  const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
    { sceneX: x1 + element.width / 2, sceneY: y1 },
    appState,
  );
  const x = viewportX - appState.offsetLeft - POPUP_WIDTH / 2;
  const y = viewportY - appState.offsetTop - SPACE_BOTTOM;
  return { x, y };
};

const shouldHideLinkPopup = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  appState: AppState,
  [clientX, clientY]: GlobalPoint,
): boolean => {
  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    { clientX, clientY },
    appState,
  );

  const threshold = 15 / appState.zoom.value;
  // hitbox to prevent hiding when hovered in element bounding box
  if (hitElementBoundingBox(pointFrom(sceneX, sceneY), element, elementsMap)) {
    return false;
  }
  const [x1, y1, x2] = getElementAbsoluteCoords(element, elementsMap);
  // hit box to prevent hiding when hovered in the vertical area between element and popover
  if (
    sceneX >= x1 &&
    sceneX <= x2 &&
    sceneY >= y1 - SPACE_BOTTOM &&
    sceneY <= y1
  ) {
    return false;
  }
  // hit box to prevent hiding when hovered around popover within threshold
  const { x: popoverX, y: popoverY } = getCoordsForPopover(
    element,
    appState,
    elementsMap,
  );

  if (
    clientX >= popoverX - threshold &&
    clientX <= popoverX + POPUP_WIDTH + POPUP_PADDING * 2 + threshold &&
    clientY >= popoverY - threshold &&
    clientY <= popoverY + threshold + POPUP_PADDING * 2 + POPUP_HEIGHT
  ) {
    return false;
  }
  return true;
};

/**
 * Angular port of upstream `components/hyperlink/Hyperlink.tsx` — the link
 * popup shown above a selected element: the link itself (or the editor
 * input), and the edit / link-to-element / remove buttons.
 */
@Component({
  selector: "caliburn-hyperlink",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  templateUrl: "./hyperlink.component.html",
})
export class CaliburnHyperlinkComponent implements AfterViewInit, OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly element = input.required<NonDeletedExcalidrawElement>();

  private readonly inputRef =
    viewChild<ElementRef<HTMLInputElement>>("linkInput");

  protected readonly popupWidth = POPUP_WIDTH;
  protected readonly popupPadding = POPUP_PADDING;
  protected readonly hintLabel = translated(() => t("labels.link.hint"));
  protected readonly emptyLabel = translated(() => t("labels.link.empty"));
  protected readonly editLabel = translated(() => t("buttons.edit"));
  protected readonly linkToElementLabel = translated(() =>
    t("labels.linkToElement"),
  );
  protected readonly removeLabel = translated(() => t("buttons.remove"));

  protected readonly inputValue = signal("");

  private autoHideTimeout: number | null = null;

  constructor() {
    // upstream seeds the input from the element's link on mount
    effect(() => {
      this.inputValue.set(this.element().link || "");
    });
  }

  protected readonly isEditing = computed(() => {
    this.editor.changeGeneration();
    return this.editor.state.showHyperlinkPopup === "editor";
  });

  /**
   * Upstream re-runs its select effect on every `isEditing` flip; the popup
   * is not remounted when the info view switches to the editor (clicking
   * "Edit"), so the selection can't ride on mount alone. Reading `inputRef`
   * makes this rerun once the input has actually been rendered.
   */
  private readonly selectOnEdit = effect(() => {
    const input = this.inputRef();
    if (this.isEditing() && input) {
      this.selectInput(input.nativeElement);
    }
  });

  protected readonly coords = computed(() => {
    this.editor.changeGeneration();
    const state = this.editor.state;
    if (
      state.contextMenu ||
      state.selectedElementsAreBeingDragged ||
      state.resizingElement ||
      state.isRotating ||
      state.openMenu ||
      state.viewModeEnabled
    ) {
      return null;
    }
    return getCoordsForPopover(
      this.element(),
      state,
      this.editor.scene.getNonDeletedElementsMap(),
    );
  });

  protected normalizedLink() {
    return normalizeLink(this.element().link || "");
  }

  protected linkTarget() {
    return isLocalLink(this.element().link) ? "_self" : "_blank";
  }

  protected onLinkClick(event: MouseEvent) {
    const element = this.element();
    const onLinkOpen = this.editor.onLinkOpen();
    if (element.link && onLinkOpen) {
      const customEvent = wrapEvent(EVENT.EXCALIDRAW_LINK, event);
      onLinkOpen(
        {
          ...element,
          link: normalizeLink(element.link),
        },
        customEvent,
      );
      if (customEvent.defaultPrevented) {
        event.preventDefault();
      }
    }
  }

  protected showRemove() {
    return !!this.element().link && !isEmbeddableElement(this.element());
  }

  ngAfterViewInit() {
    window.addEventListener(EVENT.POINTER_MOVE, this.onPointerMove, false);
  }

  ngOnDestroy() {
    window.removeEventListener(EVENT.POINTER_MOVE, this.onPointerMove, false);
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }
    this.handleSubmit();
  }

  protected onKeyDown(event: KeyboardEvent) {
    this.inputValue.set((event.target as HTMLInputElement).value);
    event.stopPropagation();
    // prevent cmd/ctrl+k shortcut when editing link
    if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.K) {
      event.preventDefault();
    }
    if (event.key === KEYS.ENTER || event.key === KEYS.ESCAPE) {
      this.handleSubmit();
      this.editor.batchCommits(() =>
        this.editor.setState({ showHyperlinkPopup: "info" }),
      );
    }
  }

  protected readonly onEdit = () => {
    trackEvent("hyperlink", "edit", "popup-ui");
    this.editor.batchCommits(() =>
      this.editor.setState({ showHyperlinkPopup: "editor" }),
    );
  };

  protected readonly onLinkToElement = () => {
    this.editor.batchCommits(() =>
      this.editor.setState({
        openDialog: {
          name: "elementLinkSelector",
          sourceElementId: this.element().id,
        },
      }),
    );
  };

  protected readonly onRemove = () => {
    trackEvent("hyperlink", "delete");
    this.editor.scene.mutateElement(this.element(), { link: null });
    this.editor.batchCommits(() =>
      this.editor.setState({ showHyperlinkPopup: false }),
    );
  };

  private selectInput(input: HTMLInputElement) {
    const editorInterface = this.editor.editorInterface;
    if (
      editorInterface.formFactor === "phone" ||
      editorInterface.isTouchScreen
    ) {
      return;
    }
    input.focus();
    input.select();
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.isEditing()) {
      return;
    }
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }
    const shouldHide = shouldHideLinkPopup(
      this.element(),
      this.editor.scene.getNonDeletedElementsMap(),
      this.editor.state,
      pointFrom(event.clientX, event.clientY),
    );
    if (shouldHide) {
      this.autoHideTimeout = window.setTimeout(() => {
        this.editor.batchCommits(() =>
          this.editor.setState({ showHyperlinkPopup: false }),
        );
      }, AUTO_HIDE_TIMEOUT);
    }
  };

  /** upstream's `handleSubmit`, run when the popup unmounts */
  private handleSubmit() {
    const input = this.inputRef()?.nativeElement;
    if (!input) {
      return;
    }

    const element = this.element();
    const link = normalizeLink(input.value) || null;

    if (!element.link && link) {
      trackEvent("hyperlink", "create");
    }

    if (isEmbeddableElement(element)) {
      if (this.editor.state.activeEmbeddable?.element === element) {
        this.editor.setState({ activeEmbeddable: null });
      }
      if (!link) {
        this.updateEmbedValidationStatus(element, false);
        this.editor.scene.mutateElement(element, { link: null });
        return;
      }

      if (!embeddableURLValidator(link, undefined)) {
        if (link) {
          this.editor.setState({
            toast: { message: t("toast.unableToEmbed"), closable: true },
          });
        }
        element.link && embeddableLinkCache.set(element.id, element.link);
        this.updateEmbedValidationStatus(element, false);
        this.editor.scene.mutateElement(element, { link });
      } else {
        const { width, height } = element;
        const embedLink = getEmbedLink(link);
        if (embedLink?.error instanceof URIError) {
          this.editor.setState({
            toast: {
              message: t("toast.unrecognizedLinkFormat"),
              closable: true,
            },
          });
        }
        const ar = embedLink
          ? embedLink.intrinsicSize.w / embedLink.intrinsicSize.h
          : 1;
        const hasLinkChanged =
          embeddableLinkCache.get(element.id) !== element.link;
        this.updateEmbedValidationStatus(element, true);
        this.editor.scene.mutateElement(element, {
          ...(hasLinkChanged
            ? {
                width:
                  embedLink?.type === "video"
                    ? width > height
                      ? width
                      : height * ar
                    : width,
                height:
                  embedLink?.type === "video"
                    ? width > height
                      ? width / ar
                      : height
                    : height,
              }
            : {}),
          link,
        });
        if (embeddableLinkCache.has(element.id)) {
          embeddableLinkCache.delete(element.id);
        }
      }
    } else {
      this.editor.scene.mutateElement(element, { link });
    }
  }

  /**
   * upstream `App.updateEmbedValidationStatus`.
   *
   * Upstream calls this *after* the `mutateElement` beside it; React batches
   * both into one render, so the order is not observable there. Caliburn's
   * scene listener commits and runs change detection synchronously inside
   * `mutateElement`, so the status has to be written first — otherwise that
   * render draws the embed layer from the stale verdict and the iframe only
   * appears on whatever commit happens next.
   */
  private updateEmbedValidationStatus(
    element: ExcalidrawEmbeddableElement,
    status: boolean,
  ) {
    this.editor.embedsValidationStatus.set(element.id, status);
    ShapeCache.delete(element);
  }
}
