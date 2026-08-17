import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  viewChild,
} from "@angular/core";
import clsx from "clsx";

import { clamp } from "@excalidraw/math";

import {
  COLOR_PALETTE,
  DEFAULT_REDUCED_GLOBAL_ALPHA,
  POINTER_EVENTS,
  THEME,
  sceneCoordsToViewportCoords,
  toValidURL,
} from "@excalidraw/common";
import {
  createSrcDoc,
  getContainingFrame,
  getCornerRadius,
  getEmbedLink,
  getRenderOpacity,
  isIframeElement,
} from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";

import type {
  ExcalidrawIframeLikeElement,
  IframeData,
  MagicGenerationData,
  NonDeleted,
  Ordered,
} from "@excalidraw/element/types";

import { translated } from "../i18n";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import type { ElementRef } from "@angular/core";

import type { CaliburnEditorComponent } from "../editor.component";

/** upstream `App.tsx`'s module-level cap on the video-embed viewport scale */
const MAX_EMBEDDABLE_VIEWPORT_SCALE = 4;

const applyIframeAttribute = (
  iframe: HTMLIFrameElement,
  name: "src" | "srcdoc",
  value: string | null,
) => {
  if (value === null) {
    if (iframe.hasAttribute(name)) {
      iframe.removeAttribute(name);
    }
  } else if (iframe.getAttribute(name) !== value) {
    iframe.setAttribute(name, value);
  }
};

/**
 * One rendered embed — upstream `App.tsx`'s per-element body inside
 * `renderEmbeddables`. Attribute-selector component
 * (`div[caliburn-embeddable]`): the host IS the
 * `.excalidraw__embeddable-container` div upstream renders, so the vendored
 * `styles.scss` rules (which position it and size everything under it) apply
 * unchanged.
 *
 * The `iframe` element type's branch is ported as upstream writes it — it is
 * driven entirely by the element's own `customData.generationData`, so a host
 * that supplies such an element gets its document, its "Generating..."
 * placeholder or its error page. The generation *triggers* upstream gates
 * behind `aiEnabled` are not part of the port.
 */
@Component({
  selector: "div[caliburn-embeddable]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "containerClass()",
    "[style.transform]": "containerTransform()",
    "[style.display]": "containerDisplay()",
    "[style.opacity]": "containerOpacity()",
    "[style.--embeddable-radius]": "embeddableRadius()",
  },
  templateUrl: "./embeddable.component.html",
})
export class CaliburnEmbeddableComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly element =
    input.required<Ordered<NonDeleted<ExcalidrawIframeLikeElement>>>();
  readonly isVisible = input.required<boolean>();

  private readonly iframeRef =
    viewChild<ElementRef<HTMLIFrameElement>>("iframe");

  /**
   * `sandbox`, `src` and `srcdoc` are applied here rather than bound in the
   * template: Angular refuses a binding to an `<iframe>`'s `sandbox`
   * (NG0910 — it must be static so it cannot be widened after the frame has
   * a document), and it would sanitize the other two, which upstream sets
   * raw. Writing them from one synchronous pass, sandbox first, keeps
   * Angular's ordering guarantee intact: the element has no document until
   * `src`/`srcdoc` lands, so the sandbox is always in force for whatever it
   * loads. Each is written only when it changed, so a render that leaves the
   * embed alone doesn't reload it.
   *
   * This is also where the `<iframe>` is handed to `App.iFrameRefs`, standing
   * in for upstream's React `ref` callback.
   */
  constructor() {
    effect(() => {
      const iframe = this.iframeRef()?.nativeElement ?? null;

      this.host.cacheEmbeddableRef(this.element(), iframe);

      if (!iframe) {
        return;
      }

      const sandbox = this.sandbox();
      if (iframe.getAttribute("sandbox") !== sandbox) {
        iframe.setAttribute("sandbox", sandbox);
      }
      applyIframeAttribute(iframe, "srcdoc", this.srcdoc());
      applyIframeAttribute(iframe, "src", this.src());
    });
  }

  private state() {
    this.host.changeGeneration();
    return this.host.state;
  }

  protected readonly isActive = computed(() => {
    const state = this.state();
    return (
      state.activeEmbeddable?.element === this.element() &&
      state.activeEmbeddable?.state === "active"
    );
  });

  protected readonly isHovered = computed(() => {
    const state = this.state();
    return (
      state.activeEmbeddable?.element === this.element() &&
      state.activeEmbeddable?.state === "hover"
    );
  });

  protected readonly hint = translated(() =>
    t("buttons.embeddableInteractionButton"),
  );

  protected readonly containerClass = computed(() =>
    clsx("excalidraw__embeddable-container", {
      "is-hovered": this.isHovered(),
    }),
  );

  protected readonly containerTransform = computed(() => {
    const state = this.state();
    const el = this.element();
    if (!this.isVisible()) {
      return "none";
    }
    const { x, y } = sceneCoordsToViewportCoords(
      { sceneX: el.x, sceneY: el.y },
      state,
    );
    return `translate(${x - state.offsetLeft}px, ${
      y - state.offsetTop
    }px) scale(${state.zoom.value})`;
  });

  protected readonly containerDisplay = computed(() =>
    this.isVisible() ? "block" : "none",
  );

  protected readonly containerOpacity = computed(() => {
    const state = this.state();
    const el = this.element();
    return `${getRenderOpacity(
      el,
      getContainingFrame(el, this.host.scene.getNonDeletedElementsMap()),
      this.host.elementsPendingErasure,
      null,
      state.openDialog?.name === "elementLinkSelector"
        ? DEFAULT_REDUCED_GLOBAL_ALPHA
        : 1,
    )}`;
  });

  protected readonly embeddableRadius = computed(() => {
    const el = this.element();
    return `${getCornerRadius(Math.min(el.width, el.height), el)}px`;
  });

  protected readonly innerWidth = computed(() =>
    this.isVisible() ? `${this.element().width}px` : "0",
  );

  protected readonly innerHeight = computed(() =>
    this.isVisible() ? `${this.element().height}px` : "0",
  );

  protected readonly innerTransform = computed(() =>
    this.isVisible() ? `rotate(${this.element().angle}rad)` : "none",
  );

  protected readonly innerPointerEvents = computed(() =>
    this.isActive() ? POINTER_EVENTS.enabled : POINTER_EVENTS.disabled,
  );

  protected readonly outerPadding = computed(
    () => `${this.element().strokeWidth}px`,
  );

  private readonly iframeData = computed<IframeData | null>(() => {
    const state = this.state();
    const el = this.element();

    if (isIframeElement(el)) {
      // upstream also falls back to its own `magicGenerations` map here,
      // which only its (unported) AI generation flow ever writes
      const data: MagicGenerationData = el.customData?.generationData || {
        status: "error",
        message: "No generation data",
        code: "ERR_NO_GENERATION_DATA",
      };

      if (data.status === "done") {
        const html = data.html;
        return {
          intrinsicSize: { w: el.width, h: el.height },
          type: "document",
          srcdoc: () => {
            return html;
          },
        } as const;
      } else if (data.status === "pending") {
        return {
          intrinsicSize: { w: el.width, h: el.height },
          type: "document",
          srcdoc: () => {
            return createSrcDoc(`
                    <style>
                      html, body {
                        width: 100%;
                        height: 100%;
                        color: ${
                          state.theme === THEME.DARK ? "white" : "black"
                        };
                      }
                      body {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        gap: 1rem;
                      }

                      .Spinner {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: auto;
                        margin-right: auto;
                      }

                      .Spinner svg {
                        animation: rotate 1.6s linear infinite;
                        transform-origin: center center;
                        width: 40px;
                        height: 40px;
                      }

                      .Spinner circle {
                        stroke: currentColor;
                        animation: dash 1.6s linear 0s infinite;
                        stroke-linecap: round;
                      }

                      @keyframes rotate {
                        100% {
                          transform: rotate(360deg);
                        }
                      }

                      @keyframes dash {
                        0% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: 0;
                        }
                        50% {
                          stroke-dasharray: 150, 300;
                          stroke-dashoffset: -200;
                        }
                        100% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: -280;
                        }
                      }
                    </style>
                    <div class="Spinner">
                      <svg
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          stroke-width="8"
                          fill="none"
                          stroke-miter-limit="10"
                        />
                      </svg>
                    </div>
                    <div>Generating...</div>
                  `);
          },
        } as const;
      }
      let message: string;
      if (data.code === "ERR_GENERATION_INTERRUPTED") {
        message = "Generation was interrupted...";
      } else {
        message = data.message || "Generation failed";
      }
      return {
        intrinsicSize: { w: el.width, h: el.height },
        type: "document",
        srcdoc: () => {
          return createSrcDoc(`
                    <style>
                    html, body {
                      height: 100%;
                    }
                      body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: ${COLOR_PALETTE.red[3]};
                      }
                      h1, h3 {
                        margin-top: 0;
                        margin-bottom: 0.5rem;
                      }
                    </style>
                    <h1>Error!</h1>
                    <h3>${message}</h3>
                  `);
        },
      } as const;
    }

    return getEmbedLink(toValidURL(el.link || ""));
  });

  /**
   * scale video embeds based on zoom (capped) so that smaller embeds
   * on canvas when zoomed are still of legible quality
   * (note: for some embed types like gdrive, the quality is poor when
   * scaling mid playback and works only when you initially start the
   * playback at the higher zoom level)
   */
  private readonly embeddableViewportScale = computed(() => {
    const shouldScaleEmbeddableViewport = this.iframeData()?.type === "video";
    return clamp(
      shouldScaleEmbeddableViewport ? this.state().zoom.value : 1,
      0.75,
      MAX_EMBEDDABLE_VIEWPORT_SCALE,
    );
  });

  protected readonly contentSize = computed(
    () => `${this.embeddableViewportScale() * 100}%`,
  );

  protected readonly contentTransform = computed(
    () => `scale(${1 / this.embeddableViewportScale()})`,
  );

  private readonly srcdoc = computed(() => {
    const src = this.iframeData();
    return src?.type === "document" ? src.srcdoc(this.state().theme) : null;
  });

  private readonly src = computed(() => {
    const src = this.iframeData();
    return src?.type !== "document" ? src?.link ?? "" : null;
  });

  private readonly sandbox = computed(
    () =>
      `${
        this.iframeData()?.sandbox?.allowSameOrigin ? "allow-same-origin" : ""
      } allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads`,
  );
}
