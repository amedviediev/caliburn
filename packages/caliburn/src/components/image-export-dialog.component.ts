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

import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  EXPORT_SCALES,
  cloneJSON,
  isFirefox,
} from "@excalidraw/common";

import { exportToCanvas } from "@excalidraw/utils/export";

import { probablySupportsClipboardBlob } from "@excalidraw/excalidraw/clipboard";
import { prepareElementsForExport } from "@excalidraw/excalidraw/data";
import { canvasToBlob } from "@excalidraw/excalidraw/data/blob";
import { nativeFileSystemSupported } from "@excalidraw/excalidraw/data/filesystem";
import { t } from "@excalidraw/excalidraw/i18n";
import { isSomeElementSelected } from "@excalidraw/excalidraw/scene";

import { NgIcon } from "@ng-icons/core";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
  actionExportWithDarkMode,
} from "../actions/actionExport";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnDialogComponent } from "./dialog.component";
import { CaliburnFilledButtonComponent } from "./filled-button.component";
import { CaliburnRadioGroupComponent } from "./radio-group.component";
import { CaliburnSwitchComponent } from "./switch.component";
import { CaliburnTooltipComponent } from "./tooltip.component";

import type { ElementRef } from "@angular/core";

import type { CaliburnEditorComponent } from "../editor.component";

const COPY_STATUS_TIMEOUT = 2000;

/** Angular port of upstream `ImageExportDialog.tsx`'s `ExportSetting`. */
@Component({
  selector: "caliburn-export-setting",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnTooltipComponent, NgIcon],
  host: {
    class: "ImageExportModal__settings__setting",
    "[attr.title]": "label()",
  },
  template: `
    <label
      [attr.for]="name() ?? null"
      class="ImageExportModal__settings__setting__label"
    >
      {{ label() }}
      @if (tooltip()) {
        <caliburn-tooltip [label]="tooltip()!" [long]="true">
          <ng-icon name="helpIcon2" />
        </caliburn-tooltip>
      }
    </label>
    <div class="ImageExportModal__settings__setting__content">
      <ng-content />
    </div>
  `,
})
export class CaliburnExportSettingComponent {
  readonly label = input.required<string>();
  readonly tooltip = input<string>();
  readonly name = input<string>();
}

/**
 * Angular port of upstream `ImageExportDialog.tsx` (`ImageExportDialog` +
 * `ImageExportModal` + `ErrorCanvasPreview`). Upstream snapshots the state
 * and elements once so the export can't change while the dialog is open; the
 * snapshot is taken in the constructor here, since the component is created
 * fresh every time the dialog opens (`caliburn-layer-ui`'s `@if`).
 */
@Component({
  selector: "caliburn-image-export-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnDialogComponent,
    CaliburnExportSettingComponent,
    CaliburnFilledButtonComponent,
    CaliburnRadioGroupComponent,
    CaliburnSwitchComponent,
  ],
  template: `
    <caliburn-dialog
      size="wide"
      [fullscreen]="isMobile"
      (closeRequest)="handleClose()"
    >
      <div class="ImageExportModal">
        <h3>{{ labels.header }}</h3>
        <div class="ImageExportModal__preview">
          <div class="ImageExportModal__preview__canvas" #preview>
            @if (renderError()) {
              <div>
                <h3>{{ labels.cannotShowPreview }}</h3>
                <p>
                  <span>{{ labels.canvasTooBig }}</span>
                </p>
                <em>({{ labels.canvasTooBigTip }})</em>
              </div>
            }
          </div>
          <div class="ImageExportModal__preview__filename">
            @if (!nativeFileSystemSupported) {
              <input
                type="text"
                class="TextInput"
                style="width: 30ch"
                [value]="projectName()"
                (input)="setProjectName($any($event.target).value)"
              />
            }
          </div>
        </div>
        <div class="ImageExportModal__settings">
          <h3>{{ labels.header }}</h3>
          @if (hasSelection) {
            <caliburn-export-setting
              [label]="labels.onlySelected"
              name="exportOnlySelected"
            >
              <caliburn-switch
                name="exportOnlySelected"
                [checked]="exportSelectionOnly()"
                (valueChange)="exportSelectionOnly.set($event)"
              />
            </caliburn-export-setting>
          }
          <caliburn-export-setting
            [label]="labels.withBackground"
            name="exportBackgroundSwitch"
          >
            <caliburn-switch
              name="exportBackgroundSwitch"
              [checked]="exportWithBackground()"
              (valueChange)="setExportWithBackground($event)"
            />
          </caliburn-export-setting>
          <caliburn-export-setting
            [label]="labels.darkMode"
            name="exportDarkModeSwitch"
          >
            <caliburn-switch
              name="exportDarkModeSwitch"
              [checked]="exportWithDarkMode()"
              (valueChange)="setExportWithDarkMode($event)"
            />
          </caliburn-export-setting>
          <caliburn-export-setting
            [label]="labels.embedScene"
            [tooltip]="labels.embedSceneTooltip"
            name="exportEmbedSwitch"
          >
            <caliburn-switch
              name="exportEmbedSwitch"
              [checked]="embedScene()"
              (valueChange)="setEmbedScene($event)"
            />
          </caliburn-export-setting>
          <caliburn-export-setting [label]="labels.scale" name="exportScale">
            <caliburn-radio-group
              name="exportScale"
              [value]="exportScale()"
              [choices]="scaleChoices"
              (valueChange)="setExportScale($event)"
            />
          </caliburn-export-setting>

          <div class="ImageExportModal__settings__buttons">
            <button
              caliburn-filled-button
              class="ImageExportModal__settings__buttons__button"
              [label]="labels.exportToPngTitle"
              [onClick]="exportToPng"
              icon="downloadIcon"
            >
              {{ labels.exportToPng }}
            </button>
            <button
              caliburn-filled-button
              class="ImageExportModal__settings__buttons__button"
              [label]="labels.exportToSvgTitle"
              [onClick]="exportToSvg"
              icon="downloadIcon"
            >
              {{ labels.exportToSvg }}
            </button>
            @if (canCopyToClipboard) {
              <button
                caliburn-filled-button
                class="ImageExportModal__settings__buttons__button"
                [label]="labels.copyPngToClipboardTitle"
                [status]="copyStatus()"
                [onClick]="copyPngToClipboard"
                icon="copyIcon"
              >
                {{ labels.copyPngToClipboard }}
              </button>
            }
          </div>
        </div>
      </div>
    </caliburn-dialog>
  `,
})
export class CaliburnImageExportDialogComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly labels = {
    header: t("imageExportDialog.header"),
    onlySelected: t("imageExportDialog.label.onlySelected"),
    withBackground: t("imageExportDialog.label.withBackground"),
    darkMode: t("imageExportDialog.label.darkMode"),
    embedScene: t("imageExportDialog.label.embedScene"),
    embedSceneTooltip: t("imageExportDialog.tooltip.embedScene"),
    scale: t("imageExportDialog.label.scale"),
    exportToPng: t("imageExportDialog.button.exportToPng"),
    exportToPngTitle: t("imageExportDialog.title.exportToPng"),
    exportToSvg: t("imageExportDialog.button.exportToSvg"),
    exportToSvgTitle: t("imageExportDialog.title.exportToSvg"),
    copyPngToClipboard: t("imageExportDialog.button.copyPngToClipboard"),
    copyPngToClipboardTitle: t("imageExportDialog.title.copyPngToClipboard"),
    cannotShowPreview: t("canvasError.cannotShowPreview"),
    canvasTooBig: t("canvasError.canvasTooBig"),
    canvasTooBigTip: t("canvasError.canvasTooBigTip"),
  };

  protected readonly nativeFileSystemSupported = nativeFileSystemSupported;
  protected readonly canCopyToClipboard =
    probablySupportsClipboardBlob || isFirefox;
  protected readonly scaleChoices = EXPORT_SCALES.map((scale) => ({
    value: scale,
    label: `${scale}×`,
  }));
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  // we need to take a snapshot so that the exported state can't be modified
  // while the dialog is open
  private readonly appStateSnapshot: AppState = cloneJSON(this.editor.state);
  private readonly elementsSnapshot: readonly NonDeletedExcalidrawElement[] =
    cloneJSON(
      this.editor.scene.getNonDeletedElements(),
    ) as NonDeletedExcalidrawElement[];

  protected readonly hasSelection = isSomeElementSelected(
    this.elementsSnapshot,
    this.appStateSnapshot,
  );

  protected readonly projectName = signal(this.editor.getName());
  protected readonly exportSelectionOnly = signal(this.hasSelection);
  protected readonly exportWithBackground = signal(
    this.appStateSnapshot.exportBackground,
  );
  protected readonly embedScene = signal(
    this.appStateSnapshot.exportEmbedScene,
  );
  protected readonly exportScale = signal(this.appStateSnapshot.exportScale);
  protected readonly renderError = signal<Error | null>(null);
  protected readonly copyStatus = signal<"success" | null>(null);

  private readonly previewRef =
    viewChild<ElementRef<HTMLDivElement>>("preview");
  private previewRenderRequestId = 0;
  private copyStatusTimeout = 0;

  private readonly exportSelection = computed(() =>
    prepareElementsForExport(
      this.elementsSnapshot,
      this.appStateSnapshot,
      this.exportSelectionOnly(),
    ),
  );

  constructor() {
    effect(() => this.renderPreview());
  }

  protected exportWithDarkMode() {
    this.editor.changeGeneration();
    return this.editor.state.exportWithDarkMode;
  }

  private renderPreview() {
    // tracked: every input the exported canvas depends on
    const projectName = this.projectName();
    const exportWithBackground = this.exportWithBackground();
    const exportWithDarkMode = this.exportWithDarkMode();
    const exportScale = this.exportScale();
    const embedScene = this.embedScene();
    const { exportedElements, exportingFrame } = this.exportSelection();

    const previewNode = this.previewRef()?.nativeElement;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    const maxHeight = previewNode.offsetHeight;
    if (!maxWidth) {
      return;
    }

    const requestId = ++this.previewRenderRequestId;
    const isStaleRequest = () => requestId !== this.previewRenderRequestId;

    exportToCanvas({
      elements: exportedElements,
      appState: {
        ...this.appStateSnapshot,
        name: projectName,
        exportBackground: exportWithBackground,
        exportWithDarkMode,
        exportScale,
        exportEmbedScene: embedScene,
      },
      files: this.editor.files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      exportingFrame,
    })
      .then(async (canvas) => {
        if (isStaleRequest()) {
          return;
        }

        // If converting to blob fails, there's some problem that will likely
        // prevent preview and export (e.g. canvas too big).
        try {
          await canvasToBlob(canvas);
        } catch (error: any) {
          if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
            throw new Error(t("canvasError.canvasTooBig"));
          }
          throw error;
        }

        if (isStaleRequest()) {
          return;
        }

        this.renderError.set(null);
        previewNode.replaceChildren(canvas);
      })
      .catch((error) => {
        if (isStaleRequest()) {
          return;
        }

        console.error(error);
        this.renderError.set(error);
      });
  }

  /** if the user changes a setting right after exporting to clipboard, reset
   * the status so they don't have to wait for the timeout to click again */
  private resetCopyStatus() {
    window.clearTimeout(this.copyStatusTimeout);
    this.copyStatus.set(null);
  }

  protected setProjectName(name: string) {
    this.resetCopyStatus();
    this.projectName.set(name);
    this.editor.actionManager.executeAction(
      actionChangeProjectName,
      "ui",
      name,
    );
  }

  protected setExportWithBackground(checked: boolean) {
    this.resetCopyStatus();
    this.exportWithBackground.set(checked);
    this.editor.actionManager.executeAction(
      actionChangeExportBackground,
      "ui",
      checked,
    );
  }

  protected setExportWithDarkMode(checked: boolean) {
    this.resetCopyStatus();
    this.editor.actionManager.executeAction(
      actionExportWithDarkMode,
      "ui",
      checked,
    );
  }

  protected setEmbedScene(checked: boolean) {
    this.resetCopyStatus();
    this.embedScene.set(checked);
    this.editor.actionManager.executeAction(
      actionChangeExportEmbedScene,
      "ui",
      checked,
    );
  }

  protected setExportScale(scale: number) {
    this.resetCopyStatus();
    this.exportScale.set(scale);
    this.editor.actionManager.executeAction(
      actionChangeExportScale,
      "ui",
      scale,
    );
  }

  protected readonly exportToPng = () => {
    const { exportedElements, exportingFrame } = this.exportSelection();
    return this.editor.onExportImage(EXPORT_IMAGE_TYPES.png, exportedElements, {
      exportingFrame,
    });
  };

  protected readonly exportToSvg = () => {
    const { exportedElements, exportingFrame } = this.exportSelection();
    return this.editor.onExportImage(EXPORT_IMAGE_TYPES.svg, exportedElements, {
      exportingFrame,
    });
  };

  protected readonly copyPngToClipboard = async () => {
    const { exportedElements, exportingFrame } = this.exportSelection();
    await this.editor.onExportImage(
      EXPORT_IMAGE_TYPES.clipboard,
      exportedElements,
      { exportingFrame },
    );
    window.clearTimeout(this.copyStatusTimeout);
    this.copyStatus.set("success");
    this.copyStatusTimeout = window.setTimeout(() => {
      this.copyStatus.set(null);
    }, COPY_STATUS_TIMEOUT);
  };

  protected handleClose() {
    this.editor.batchCommits(() => this.editor.setState({ openDialog: null }));
  }
}
