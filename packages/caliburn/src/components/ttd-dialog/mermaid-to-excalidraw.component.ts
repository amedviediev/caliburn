import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  signal,
  viewChild,
} from "@angular/core";

import { EDITOR_LS_KEYS, debounce, isDevEnv } from "@excalidraw/common";

import { EditorLocalStorage } from "@excalidraw/excalidraw/data/EditorLocalStorage";
import { t } from "@excalidraw/excalidraw/i18n";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";
import {
  convertMermaidToExcalidraw,
  resetPreview,
  saveMermaidDataToStorage,
} from "@excalidraw/excalidraw/components/TTDDialog/common";
import { getMermaidAutoFixCandidates } from "@excalidraw/excalidraw/components/TTDDialog/utils/mermaidAutoFix";
import {
  getMermaidErrorLineNumber,
  isMermaidAutoFixableError,
} from "@excalidraw/excalidraw/components/TTDDialog/utils/mermaidError";

import { NgIcon } from "@ng-icons/core";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { addElementsFromPasteOrLibrary } from "../../clipboard-interaction";
import { CaliburnButtonComponent } from "../button.component";

import { CaliburnTTDDialogInputComponent } from "./ttd-dialog-input.component";
import { CaliburnTTDDialogOutputComponent } from "./ttd-dialog-output.component";

import type { OnDestroy } from "@angular/core";

import type { CaliburnEditorComponent } from "../../editor.component";

const MERMAID_EXAMPLE =
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[Car]";

const debouncedSaveMermaidDefinition = debounce(saveMermaidDataToStorage, 300);
const AUTO_FIX_DEBOUNCE_MS = 500;
const AUTO_FIX_MAX_DEPTH = 4;
const AUTO_FIX_MAX_CANDIDATES = 30;

/** the doc links upstream's `<Trans i18nKey="mermaid.description">` fills in
 * for the `<flowchartLink>`/`<sequenceLink>`/`<classLink>`/`<erdLink>`
 * markers */
const DESCRIPTION_LINKS: Record<string, string> = {
  flowchartLink: "https://mermaid.js.org/syntax/flowchart.html",
  sequenceLink: "https://mermaid.js.org/syntax/sequenceDiagram.html",
  classLink: "https://mermaid.js.org/syntax/classDiagram.html",
  erdLink: "https://mermaid.js.org/syntax/entityRelationshipDiagram.html",
};

const parseDescription = (raw: string) => {
  const runs: { text: string; href: string | null }[] = [];
  const marker = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;
  let match = marker.exec(raw);

  while (match !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: raw.slice(lastIndex, match.index), href: null });
    }
    runs.push({ text: match[2], href: DESCRIPTION_LINKS[match[1]] ?? null });
    lastIndex = marker.lastIndex;
    match = marker.exec(raw);
  }
  if (lastIndex < raw.length) {
    runs.push({ text: raw.slice(lastIndex), href: null });
  }

  return runs;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "";
};

/**
 * Angular port of upstream `TTDDialog/MermaidToExcalidraw.tsx` — the free
 * (non-Plus) half of the text-to-diagram dialog.
 *
 * The conversion itself is not reimplemented: `convertMermaidToExcalidraw`,
 * `resetPreview` and `saveMermaidDataToStorage` are imported straight from
 * the vendored `TTDDialog/common.ts`, and the auto-fix probe reuses
 * `getMermaidAutoFixCandidates`/`isMermaidAutoFixableError`. Their
 * `React.RefObject<T>`/`React.MutableRefObject<T>` parameters are structurally
 * `{ current: T }`, so plain object literals satisfy them.
 *
 * Deviations from upstream, all forced by the port boundary:
 *
 * - `TTDDialogPanel`'s `link`/`rateLimit` action variants and its
 *   `onTextSubmitInProgess` spinner are AI-tab-only, so the panel markup is
 *   written out here with just the `button` variant the mermaid tab uses.
 * - `useDeferredValue(text)` has no Angular equivalent; the render effect
 *   reads the `text` signal directly. A request-id guard drops stale
 *   conversions instead.
 * - `isActive` is always true: with the AI tab gated out the mermaid tab is
 *   the only tab, so it can never be the inactive one.
 */
@Component({
  selector: "caliburn-mermaid-to-excalidraw",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnButtonComponent,
    CaliburnTTDDialogInputComponent,
    CaliburnTTDDialogOutputComponent,
    NgIcon,
  ],
  templateUrl: "./mermaid-to-excalidraw.component.html",
})
export class CaliburnMermaidToExcalidrawComponent implements OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly labels = {
    inputPlaceholder: t("mermaid.inputPlaceholder"),
    insert: t("mermaid.button"),
    modifier: getShortcutKey("CtrlOrCmd"),
    enter: getShortcutKey("Enter"),
  };
  // upstream's copy says "rendered as image in Excalidraw"; the target is
  // this app's own scene, not upstream's — safe ahead of parseDescription
  // since it only scans for `<tag>…</tag>` markers, none of which match
  protected readonly descriptionRuns = parseDescription(
    t("mermaid.description").replace(/Excalidraw/g, "Caliburn"),
  );

  protected readonly text = signal(
    EditorLocalStorage.get<string>(EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW) ||
      MERMAID_EXAMPLE,
  );
  protected readonly error = signal<Error | null>(null);
  protected readonly autoFixCandidate = signal<string | null>(null);
  protected readonly mermaidLoaded = signal(false);

  private readonly mermaidApi = import("@excalidraw/mermaid-to-excalidraw");
  private readonly data: {
    current: {
      elements: readonly NonDeletedExcalidrawElement[];
      files: BinaryFiles | null;
    };
  } = { current: { elements: [], files: null } };

  private readonly output = viewChild(CaliburnTTDDialogOutputComponent);
  private renderRequestId = 0;

  protected readonly hasAutoFix = computed(() => !!this.autoFixCandidate());

  /** upstream derives this from `deferredText`; caliburn has no deferred
   * value, so it reads `text` — see the class note above */
  protected readonly errorLine = computed(() => {
    const message = this.error()?.message;
    if (!message) {
      return null;
    }
    return getMermaidErrorLineNumber(message, this.text());
  });

  constructor() {
    this.mermaidApi.then(() => this.mermaidLoaded.set(true));
    effect(() => this.renderPreview());
    effect((onCleanup) => this.probeAutoFix(onCleanup));
  }

  ngOnDestroy() {
    debouncedSaveMermaidDefinition.flush();
  }

  protected theme() {
    this.editor.changeGeneration();
    return this.editor.state.theme;
  }

  protected onTextChange(value: string) {
    this.text.set(value);
  }

  protected onApplyAutoFix() {
    const candidate = this.autoFixCandidate();
    if (candidate) {
      this.text.set(candidate);
    }
  }

  protected onInsertToEditor() {
    const { elements, files } = this.data.current;

    if (!elements.length) {
      return;
    }

    addElementsFromPasteOrLibrary(this.editor, {
      elements,
      files,
      position: "center",
      fit: "scale-down",
    });
    this.editor.batchCommits(() => this.editor.setState({ openDialog: null }));

    saveMermaidDataToStorage(this.text());
  }

  private async renderPreview() {
    // tracked: everything the rendered preview depends on. `canvasElement()`
    // reads the output component's own `viewChild` signal, so the effect
    // re-runs once the preview canvas host is in the DOM (it is behind the
    // output's `loaded` branch, i.e. it appears when the mermaid lib
    // resolves).
    const mermaidDefinition = this.text();
    const theme = this.theme();
    const canvasNode = this.output()?.canvasElement() ?? null;

    debouncedSaveMermaidDefinition(mermaidDefinition);

    if (!canvasNode) {
      return;
    }

    const requestId = ++this.renderRequestId;
    const isStaleRequest = () => requestId !== this.renderRequestId;
    const canvasRef = { current: canvasNode };
    const setError = (error: Error | null) => {
      if (!isStaleRequest()) {
        this.error.set(error);
      }
    };

    try {
      if (!mermaidDefinition.trim()) {
        resetPreview({ canvasRef, setError });
        return;
      }

      const result = await convertMermaidToExcalidraw({
        canvasRef,
        data: this.data,
        mermaidToExcalidrawLib: {
          loaded: true,
          api: this.mermaidApi,
        },
        setError,
        mermaidDefinition,
        theme,
      });

      if (!result.success) {
        setError(result.error ?? new Error("Invalid mermaid definition"));
      }
    } catch (err) {
      if (isDevEnv()) {
        console.error("Failed to parse mermaid definition", err);
      }
    }
  }

  private probeAutoFix(onCleanup: (fn: () => void) => void) {
    const sourceText = this.text();
    const errorMessage = this.error()?.message ?? "";
    const loaded = this.mermaidLoaded();

    const shouldTryAutoFix =
      isMermaidAutoFixableError(errorMessage) && !!sourceText.trim() && loaded;

    if (!shouldTryAutoFix) {
      this.autoFixCandidate.set(null);
      return;
    }

    const candidates = getMermaidAutoFixCandidates(sourceText, errorMessage);
    if (!candidates.length) {
      this.autoFixCandidate.set(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const api = await this.mermaidApi;
        const seen = new Set<string>([sourceText]);
        const queue = candidates.map((candidate) => ({
          text: candidate,
          depth: 1,
        }));

        let triedCandidates = 0;

        while (queue.length > 0 && triedCandidates < AUTO_FIX_MAX_CANDIDATES) {
          const current = queue.shift();
          if (!current || seen.has(current.text)) {
            continue;
          }
          seen.add(current.text);
          triedCandidates += 1;

          try {
            await api.parseMermaidToExcalidraw(current.text);
            if (!cancelled) {
              this.autoFixCandidate.set(current.text);
            }
            return;
          } catch (candidateError) {
            if (current.depth >= AUTO_FIX_MAX_DEPTH) {
              continue;
            }
            const nextErrorMessage = getErrorMessage(candidateError);
            if (!nextErrorMessage) {
              continue;
            }
            const nextCandidates = getMermaidAutoFixCandidates(
              current.text,
              nextErrorMessage,
            );
            for (const nextCandidate of nextCandidates) {
              if (!seen.has(nextCandidate)) {
                queue.push({
                  text: nextCandidate,
                  depth: current.depth + 1,
                });
              }
            }
          }
        }
      } catch {
        // ignore auto-fix probe errors
      }
      if (!cancelled) {
        this.autoFixCandidate.set(null);
      }
    }, AUTO_FIX_DEBOUNCE_MS);

    onCleanup(() => {
      cancelled = true;
      window.clearTimeout(timer);
    });
  }
}
