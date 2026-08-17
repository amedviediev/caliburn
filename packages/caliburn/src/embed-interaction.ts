import { pointDistance, pointFrom } from "@excalidraw/math";

import {
  CURSOR_TYPE,
  DRAGGING_THRESHOLD,
  POINTER_BUTTON,
  YOUTUBE_STATES,
  oneOf,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { isIframeElement, isIframeLikeElement } from "@excalidraw/element";

import type { ValueOf } from "@excalidraw/common/utility-types";

import type {
  ExcalidrawIframeLikeElement,
  ExcalidrawElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { gesture, isHoldingSpace } from "./pan-gesture";
import { getElementAtPosition } from "./selection-interaction";

import type { CaliburnEditorComponent } from "./editor.component";

/**
 * Map of youtube embed video states.
 *
 * Upstream keeps this module-level in `App.tsx`; here it sits beside its two
 * readers — the center-click play/pause handshake below and
 * `onWindowMessage`, which the player reports its state back through.
 */
const YOUTUBE_VIDEO_STATES = new Map<
  ExcalidrawElement["id"],
  ValueOf<typeof YOUTUBE_STATES>
>();

/**
 * upstream `App.onWindowMessage` — the vimeo/youtube player protocol.
 *
 * Upstream registers it unbound (`addEventListener(window, EVENT.MESSAGE,
 * this.onWindowMessage)`) and it reads no editor state, so it ports as a
 * plain function; it reaches every editor on the page through the
 * `iframe.excalidraw__embeddable` query, exactly as upstream's does.
 */
export const onWindowMessage = (event: MessageEvent) => {
  if (
    event.origin !== "https://player.vimeo.com" &&
    event.origin !== "https://www.youtube.com"
  ) {
    return;
  }

  let data = null;
  try {
    data = JSON.parse(event.data);
  } catch (e) {}
  if (!data) {
    return;
  }

  switch (event.origin) {
    case "https://player.vimeo.com":
      //Allowing for multiple instances of Excalidraw running in the window
      if (data.method === "paused") {
        let source: Window | null = null;
        const iframes = document.body.querySelectorAll(
          "iframe.excalidraw__embeddable",
        );
        if (!iframes) {
          break;
        }
        for (const iframe of iframes as NodeListOf<HTMLIFrameElement>) {
          if (iframe.contentWindow === event.source) {
            source = iframe.contentWindow;
          }
        }
        source?.postMessage(
          JSON.stringify({
            method: data.value ? "play" : "pause",
            value: true,
          }),
          "*",
        );
      }
      break;
    case "https://www.youtube.com":
      if (
        data.event === "infoDelivery" &&
        data.info &&
        data.id &&
        typeof data.info.playerState === "number"
      ) {
        const id = data.id;
        const playerState = data.info.playerState as number;
        if ((Object.values(YOUTUBE_STATES) as number[]).includes(playerState)) {
          YOUTUBE_VIDEO_STATES.set(
            id,
            playerState as ValueOf<typeof YOUTUBE_STATES>,
          );
        }
      }
      break;
  }
};

const isIframeLikeElementCenter = (
  editor: CaliburnEditorComponent,
  el: ExcalidrawIframeLikeElement | null,
  event: PointerEvent,
  sceneX: number,
  sceneY: number,
) => {
  return (
    el &&
    !event.altKey &&
    !event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    (editor.state.activeEmbeddable?.element !== el ||
      editor.state.activeEmbeddable?.state === "hover" ||
      !editor.state.activeEmbeddable) &&
    sceneX >= el.x + el.width / 3 &&
    sceneX <= el.x + (2 * el.width) / 3 &&
    sceneY >= el.y + el.height / 3 &&
    sceneY <= el.y + (2 * el.height) / 3
  );
};

/** upstream `App.handleIframeLikeElementHover` */
export const handleIframeLikeElementHover = (
  editor: CaliburnEditorComponent,
  {
    hitElement,
    scenePointer,
    moveEvent,
  }: {
    hitElement: NonDeleted<ExcalidrawElement> | null;
    scenePointer: { x: number; y: number };
    moveEvent: PointerEvent;
  },
): boolean => {
  if (
    hitElement &&
    isIframeLikeElement(hitElement) &&
    (editor.state.viewModeEnabled ||
      editor.state.activeTool.type === "laser" ||
      isIframeLikeElementCenter(
        editor,
        hitElement,
        moveEvent,
        scenePointer.x,
        scenePointer.y,
      ))
  ) {
    editor.cursor.set(CURSOR_TYPE.POINTER);
    editor.setState({
      activeEmbeddable: { element: hitElement, state: "hover" },
    });
    return true;
  } else if (editor.state.activeEmbeddable?.state === "hover") {
    editor.setState({ activeEmbeddable: null });
  }
  return false;
};

/**
 * upstream `App.handleIframeLikeCenterClick`.
 *
 * @returns true if iframe-like element click handled
 */
export const handleIframeLikeCenterClick = (
  editor: CaliburnEditorComponent,
): boolean => {
  if (
    !editor.lastPointerDownEvent ||
    !editor.lastPointerUpEvent ||
    // middle-click or something other than primary
    editor.lastPointerDownEvent.button !== POINTER_BUTTON.MAIN ||
    // panning
    isHoldingSpace() ||
    // wrong tool
    !oneOf(editor.state.activeTool.type, ["laser", "selection", "lasso"])
  ) {
    return false;
  }

  const viewportClickStart_scenePoint = pointFrom(
    viewportCoordsToSceneCoords(
      {
        clientX: editor.lastPointerDownEvent.clientX,
        clientY: editor.lastPointerDownEvent.clientY,
      },
      editor.state,
    ),
  );
  const viewportClickEnd_scenePoint = pointFrom(
    viewportCoordsToSceneCoords(
      {
        clientX: editor.lastPointerUpEvent.clientX,
        clientY: editor.lastPointerUpEvent.clientY,
      },
      editor.state,
    ),
  );

  const draggedDistance = pointDistance(
    viewportClickStart_scenePoint,
    viewportClickEnd_scenePoint,
  );

  if (draggedDistance > DRAGGING_THRESHOLD) {
    return false;
  }

  const hitElement = getElementAtPosition(
    editor,
    viewportClickStart_scenePoint[0],
    viewportClickStart_scenePoint[1],
  );

  const shouldActivate =
    hitElement &&
    editor.lastPointerUpEvent.timeStamp -
      editor.lastPointerDownEvent.timeStamp <=
      300 &&
    gesture.pointers.size < 2 &&
    isIframeLikeElement(hitElement) &&
    (editor.state.viewModeEnabled ||
      editor.state.activeTool.type === "laser" ||
      isIframeLikeElementCenter(
        editor,
        hitElement,
        editor.lastPointerUpEvent,
        viewportClickEnd_scenePoint[0],
        viewportClickEnd_scenePoint[1],
      ));

  if (!shouldActivate) {
    return false;
  }

  const iframeLikeElement = hitElement;

  if (
    editor.state.activeEmbeddable?.element === iframeLikeElement &&
    editor.state.activeEmbeddable?.state === "active"
  ) {
    return true;
  }

  // The delay serves two purposes
  // 1. To prevent first click propagating to iframe on mobile,
  //    else the click will immediately start and stop the video
  // 2. If the user double clicks the frame center to activate it
  //    without the delay youtube will immediately open the video
  //    in fullscreen mode
  setTimeout(() => {
    editor.batchCommits(() =>
      editor.setState({
        activeEmbeddable: { element: iframeLikeElement, state: "active" },
        selectedElementIds: { [iframeLikeElement.id]: true },
        newElement: null,
        selectionElement: null,
      }),
    );
  }, 100);

  if (isIframeElement(iframeLikeElement)) {
    return true;
  }

  const iframe = editor.getHTMLIFrameElement(iframeLikeElement);

  if (!iframe?.contentWindow) {
    return true;
  }

  if (iframe.src.includes("youtube")) {
    const state = YOUTUBE_VIDEO_STATES.get(iframeLikeElement.id);
    if (!state) {
      YOUTUBE_VIDEO_STATES.set(iframeLikeElement.id, YOUTUBE_STATES.UNSTARTED);
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "listening",
          id: iframeLikeElement.id,
        }),
        "*",
      );
    }
    switch (state) {
      case YOUTUBE_STATES.PLAYING:
      case YOUTUBE_STATES.BUFFERING:
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func: "pauseVideo",
            args: "",
          }),
          "*",
        );
        break;
      default:
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            event: "command",
            func: "playVideo",
            args: "",
          }),
          "*",
        );
    }
  }

  if (iframe.src.includes("player.vimeo.com")) {
    iframe.contentWindow.postMessage(
      JSON.stringify({
        method: "paused", //video play/pause in onWindowMessage handler
      }),
      "*",
    );
  }

  return true;
};
