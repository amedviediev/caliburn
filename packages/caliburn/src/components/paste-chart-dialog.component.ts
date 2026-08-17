import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { KEYS, THEME } from "@excalidraw/common";

import { newTextElement } from "@excalidraw/element";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  isSpreadsheetValidForChartType,
  renderSpreadsheet,
} from "@excalidraw/excalidraw/charts";
import { t } from "@excalidraw/excalidraw/i18n";
import { exportToSvg } from "@excalidraw/excalidraw/scene/export";

import { NgIcon } from "@ng-icons/core";

import type { ChartType } from "@excalidraw/element/types";

import type { ChartElements, Spreadsheet } from "@excalidraw/excalidraw/charts";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import { CaliburnDialogComponent } from "./dialog.component";

import type { EffectCleanupRegisterFn, ElementRef } from "@angular/core";

import type { CaliburnEditorComponent } from "../editor.component";

type ChartPreviewMode = ChartType | "plaintext";

const getChartTypeLabel = (chartType: ChartType) => {
  switch (chartType) {
    case "bar":
      return t("labels.chartType_bar");
    case "line":
      return t("labels.chartType_line");
    case "radar":
      return t("labels.chartType_radar");
    default:
      return chartType;
  }
};

/**
 * Angular port of upstream `PasteChartDialog.tsx`'s `ChartPreviewBtn` and
 * `PlainTextPreviewBtn`, which are the same button rendering the same SVG
 * preview off different elements — one component with a `mode` here, so the
 * preview machinery isn't written twice. Attribute-selector on the `<button>`
 * so the DOM is upstream's exactly (`PasteChartDialog.scss` styles
 * `.ChartPreview` as a flex column of its two children, which a wrapper
 * element would break).
 */
@Component({
  selector: "button[caliburn-chart-preview]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: "button",
    class: "ChartPreview",
    "[attr.aria-label]": "label()",
    "(click)": "handleClick()",
  },
  templateUrl: "./chart-preview.component.html",
})
export class CaliburnChartPreviewComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly mode = input.required<ChartPreviewMode>();
  readonly spreadsheet = input<Spreadsheet | null>(null);
  readonly colorSeed = input(0);
  readonly rawText = input("");

  readonly selected = output<ChartElements>();

  protected readonly label = translated(() => {
    const mode = this.mode();
    return mode === "plaintext"
      ? t("labels.chartType_plaintext")
      : getChartTypeLabel(mode);
  });

  private readonly previewElements = computed<ChartElements | null>(() => {
    const mode = this.mode();
    if (mode === "plaintext") {
      const rawText = this.rawText();
      return rawText ? [newTextElement({ text: rawText, x: 0, y: 0 })] : null;
    }
    const spreadsheet = this.spreadsheet();
    return spreadsheet
      ? renderSpreadsheet(mode, spreadsheet, 0, 0, this.colorSeed())
      : null;
  });

  private readonly previewRef =
    viewChild<ElementRef<HTMLDivElement>>("preview");
  private previewRenderRequestId = 0;

  constructor() {
    effect((onCleanup) => this.renderPreview(onCleanup));
  }

  private theme() {
    this.editor.changeGeneration();
    return this.editor.state.theme;
  }

  private renderPreview(onCleanup: EffectCleanupRegisterFn) {
    const elements = this.previewElements();
    const exportWithDarkMode = this.theme() === THEME.DARK;

    const previewNode = this.previewRef()?.nativeElement;
    if (!previewNode) {
      return;
    }

    const requestId = ++this.previewRenderRequestId;

    if (!elements) {
      previewNode.replaceChildren();
      return;
    }

    exportToSvg(
      elements,
      {
        exportBackground: false,
        viewBackgroundColor: "#fff",
        exportWithDarkMode,
      },
      null, // files
      {
        skipInliningFonts: true,
      },
    ).then((svg) => {
      // upstream lets a stale resolve append its svg over a newer one; the
      // request id is the same guard `caliburn-image-export-dialog` uses
      if (requestId !== this.previewRenderRequestId) {
        return;
      }
      svg.querySelector(".style-fonts")?.remove();
      previewNode.replaceChildren();
      previewNode.appendChild(svg);
    });

    onCleanup(() => {
      previewNode.replaceChildren();
    });
  }

  protected handleClick() {
    const elements = this.previewElements();
    if (elements) {
      this.selected.emit(elements);
    }
  }
}

/**
 * Angular port of upstream `PasteChartDialog.tsx` — the dialog a spreadsheet
 * paste opens, offering the chart types the pasted data supports plus the
 * plain-text fallback.
 *
 * Upstream's `title` is a `ReactNode`; caliburn's `caliburn-dialog` grew a
 * `titleTemplate` input for it (a `TemplateRef` rather than a projected slot,
 * so the `<h2 id=…-dialog-title>` wrapper the modal's `aria-labelledby`
 * resolves against stays inside the dialog).
 */
@Component({
  selector: "caliburn-paste-chart-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnChartPreviewComponent, CaliburnDialogComponent, NgIcon],
  templateUrl: "./paste-chart-dialog.component.html",
})
export class CaliburnPasteChartDialogComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly data = input.required<Spreadsheet>();
  readonly rawText = input.required<string>();

  readonly close = output<void>();

  protected readonly titleText = translated(() => t("labels.pasteCharts"));
  protected readonly colorSeed = signal(Math.random());

  protected readonly validChartTypes = computed(() =>
    (["bar", "line", "radar"] as const).filter((chartType) =>
      isSpreadsheetValidForChartType(this.data(), chartType),
    ),
  );

  protected handleReshuffleColors() {
    this.colorSeed.set(Math.random());
  }

  protected handleReshuffleKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.ENTER || event.key === KEYS.SPACE) {
      event.preventDefault();
      this.handleReshuffleColors();
    }
  }

  protected handleClose() {
    this.close.emit();
  }

  protected handleChartClick(chartType: ChartType, elements: ChartElements) {
    this.editor.onInsertElements(elements);
    trackEvent("paste", "chart", chartType);
    this.close.emit();
    this.editor.focusContainer();
  }

  protected handlePlainTextClick(rawText: string) {
    const textElement = newTextElement({
      text: rawText,
      x: 0,
      y: 0,
    });
    this.editor.onInsertElements([textElement]);
    trackEvent("paste", "chart", "plaintext");
    this.close.emit();
    this.editor.focusContainer();
  }
}
