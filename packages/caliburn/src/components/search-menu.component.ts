import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

import {
  CLASSES,
  EVENT,
  FONT_FAMILY,
  FRAME_STYLE,
  KEYS,
  addEventListener,
  debounce,
  getFontString,
  getLineHeight,
  randomInteger,
} from "@excalidraw/common";

import {
  getCommonBounds,
  isElementCompletelyInViewport,
  isFrameLikeElement,
  isTextElement,
  measureText,
  newTextElement,
} from "@excalidraw/element";

import { getDefaultFrameName } from "@excalidraw/element/frame";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import type { SearchMatch } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnButtonComponent } from "./button.component";
import { CaliburnTextFieldComponent } from "./text-field.component";

import type { CaliburnEditorComponent } from "../editor.component";
import type { OnDestroy } from "@angular/core";

const SEARCH_DEBOUNCE = 350;

type SearchMatchItem = {
  element: ExcalidrawTextElement | ExcalidrawFrameLikeElement;
  searchQuery: SearchQuery;
  index: number;
  preview: {
    indexInSearchQuery: number;
    previewText: string;
    moreBefore: boolean;
    moreAfter: boolean;
  };
  matchedLines: SearchMatch["matchedLines"];
};

type SearchMatches = {
  nonce: number | null;
  items: SearchMatchItem[];
};

type SearchQuery = string & { _brand: "SearchQuery" };

/**
 * Angular port of upstream `SearchMenu.tsx`.
 *
 * Upstream's two per-editor jotai atoms (`searchQueryAtom`,
 * `searchItemInFocusAtom`) are the editor's `searchQuery` /
 * `searchItemInFocus` signals — they outlive this component, which upstream
 * mounts and unmounts with the sidebar tab.
 *
 * Upstream's effects become explicit calls so that the appState update lands
 * synchronously with the event that caused it (Angular effects only run on
 * the next change-detection pass, while upstream's tests — and the editor's
 * own keyboard path — observe `appState.searchMatches` right after the
 * keystroke):
 * - the "search on query / scene change" effect stays an `effect()`, keyed
 *   off the editor's `changeGeneration()` (its scene-nonce guard is upstream's);
 * - the focus-mapping and scroll-into-view effects run from `setFocusIndex()`
 *   and from the search callback, in upstream's order (matches first, then
 *   the focus flags).
 *
 * `MatchList`'s `memo`/`areEqual` has no port — the list is re-rendered by
 * Angular only when the signals it reads change, which is the same set of
 * inputs (`matches.nonce`, `focusIndex`).
 */
@Component({
  selector: "caliburn-search-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnButtonComponent, CaliburnTextFieldComponent, NgIcon],
  host: {
    class: "layer-ui__search",
  },
  templateUrl: "./search-menu.component.html",
})
export class CaliburnSearchMenuComponent implements OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private readonly textField = viewChild(CaliburnTextFieldComponent);

  protected readonly inputWrapperClass = CLASSES.SEARCH_MENU_INPUT_WRAPPER;
  protected readonly placeholder = t("search.placeholder");
  protected readonly noMatchLabel = t("search.noMatch");
  protected readonly framesLabel = t("search.frames");
  protected readonly textsLabel = t("search.texts");

  protected readonly inputValue = this.editor.searchQuery;
  protected readonly focusIndex = this.editor.searchItemInFocus;
  protected readonly searchQuery = computed(
    () => this.inputValue().trim() as SearchQuery,
  );

  protected readonly searchMatches = signal<SearchMatches>({
    nonce: null,
    items: [],
  });
  protected readonly searchedQuery = signal<SearchQuery | null>(null);

  private readonly isSearching = signal(false);
  private destroyed = false;
  private lastSceneNonce: number | undefined = undefined;
  private dispatchedSearch: {
    query: SearchQuery;
    nonce: number | undefined;
  } | null = null;

  protected readonly frameNameMatches = computed(() =>
    this.searchMatches().items.filter((match) =>
      isFrameLikeElement(match.element),
    ),
  );

  protected readonly textMatches = computed(() =>
    this.searchMatches().items.filter((match) => isTextElement(match.element)),
  );

  protected readonly matchCount = computed(() => {
    const count = this.searchMatches().items.length;
    return `${count} ${
      count === 1 ? t("search.singleResult") : t("search.multipleResults")
    }`;
  });

  private readonly detachKeyDown = addEventListener(
    window,
    EVENT.KEYDOWN,
    // `capture` needed to prevent firing on initial open from the editor's
    // own keyboard path, as well as to handle events before the editor ones
    (event: Event) => this.handleKeyDown(event as KeyboardEvent),
    { capture: true, passive: false },
  );

  constructor() {
    effect(() => {
      // the editor commits on every scene change, so this stands in for
      // upstream's `elementsMap` effect dependency
      this.editor.changeGeneration();
      const isSearching = this.isSearching();
      const searchQuery = this.searchQuery();

      untracked(() => {
        if (isSearching) {
          return;
        }

        const sceneNonce = this.editor.scene.getSceneNonce();

        if (
          searchQuery !== this.searchedQuery() ||
          sceneNonce !== this.lastSceneNonce
        ) {
          if (
            this.dispatchedSearch?.query === searchQuery &&
            this.dispatchedSearch?.nonce === sceneNonce
          ) {
            // a search over the same inputs is already pending — restarting
            // it would keep pushing the debounce out on every unrelated commit
            return;
          }
          this.dispatchedSearch = { query: searchQuery, nonce: sceneNonce };
          this.searchedQuery.set(null);
          handleSearch(searchQuery, this.editor, (matchItems) => {
            if (this.destroyed) {
              return;
            }
            this.applyMatches(searchQuery, matchItems);
          });
        }
      });
    });
  }

  ngOnDestroy() {
    // the debounced search is module-level (as upstream's is), so a run
    // dispatched just before teardown must not resurrect the matches
    this.destroyed = true;
    this.detachKeyDown();
    this.focusIndex.set(null);
    this.searchedQuery.set(null);
    this.lastSceneNonce = undefined;
    this.dispatchedSearch = null;
    this.isSearching.set(false);
    if (!this.editor.unmounted) {
      this.editor.batchCommits(() =>
        this.editor.setState({ searchMatches: null }),
      );
    }
  }

  protected handleInputChange(value: string) {
    this.inputValue.set(value);
    this.isSearching.set(true);
    const searchQuery = value.trim() as SearchQuery;
    this.dispatchedSearch = {
      query: searchQuery,
      nonce: this.editor.scene.getSceneNonce(),
    };
    handleSearch(searchQuery, this.editor, (matchItems, index) => {
      if (this.destroyed) {
        return;
      }
      this.applyMatches(searchQuery, matchItems);
      this.setFocusIndex(index);
      this.isSearching.set(false);
    });
  }

  protected goToNextItem() {
    if (this.searchMatches().items.length > 0) {
      const focusIndex = this.focusIndex();
      this.setFocusIndex(
        focusIndex === null
          ? 0
          : (focusIndex + 1) % this.searchMatches().items.length,
      );
    }
  }

  protected goToPreviousItem() {
    if (this.searchMatches().items.length > 0) {
      const focusIndex = this.focusIndex();
      this.setFocusIndex(
        focusIndex === null
          ? 0
          : focusIndex - 1 < 0
          ? this.searchMatches().items.length - 1
          : focusIndex - 1,
      );
    }
  }

  protected setFocusIndex(index: number | null) {
    const prevIndex = this.focusIndex();
    this.focusIndex.set(index);
    if (prevIndex !== index) {
      this.applyFocusToMatches();
    }
    this.scrollFocusedMatchIntoView();
  }

  protected previewBefore(match: SearchMatchItem) {
    return (
      (match.preview.moreBefore ? "..." : "") +
      match.preview.previewText.slice(0, match.preview.indexInSearchQuery)
    );
  }

  protected previewMatch(match: SearchMatchItem) {
    return match.preview.previewText.slice(
      match.preview.indexInSearchQuery,
      match.preview.indexInSearchQuery + match.searchQuery.length,
    );
  }

  protected previewAfter(match: SearchMatchItem) {
    return (
      match.preview.previewText.slice(
        match.preview.indexInSearchQuery + match.searchQuery.length,
      ) + (match.preview.moreAfter ? "..." : "")
    );
  }

  private applyMatches(
    searchQuery: SearchQuery,
    matchItems: SearchMatchItem[],
  ) {
    this.searchMatches.set({ nonce: randomInteger(), items: matchItems });
    this.searchedQuery.set(searchQuery);
    this.lastSceneNonce = this.editor.scene.getSceneNonce();
    this.editor.batchCommits(() =>
      this.editor.setState({
        searchMatches: matchItems.length
          ? {
              focusedId: null,
              matches: matchItems.map((searchMatch) => ({
                id: searchMatch.element.id,
                focus: false,
                matchedLines: searchMatch.matchedLines,
              })),
            }
          : null,
      }),
    );
  }

  private applyFocusToMatches() {
    const focusIndex = this.focusIndex();
    this.editor.batchCommits(() =>
      this.editor.setState((state) => {
        if (!state.searchMatches) {
          return null;
        }

        const focusedId =
          focusIndex !== null
            ? state.searchMatches?.matches[focusIndex]?.id || null
            : null;

        return {
          searchMatches: {
            focusedId,
            matches: state.searchMatches.matches.map((match, index) => {
              if (index === focusIndex) {
                return { ...match, focus: true };
              }
              return { ...match, focus: false };
            }),
          },
        };
      }),
    );
  }

  private scrollFocusedMatchIntoView() {
    const focusIndex = this.focusIndex();
    const items = this.searchMatches().items;
    if (items.length === 0 || focusIndex === null) {
      return;
    }

    const match = items[focusIndex];
    if (!match) {
      return;
    }

    this.scrollResultItemIntoView();

    const app = this.editor;
    const zoomValue = app.state.zoom.value;

    const matchAsElement = newTextElement({
      text: match.searchQuery,
      x: match.element.x + (match.matchedLines[0]?.offsetX ?? 0),
      y: match.element.y + (match.matchedLines[0]?.offsetY ?? 0),
      width: match.matchedLines[0]?.width,
      height: match.matchedLines[0]?.height,
      fontSize: isFrameLikeElement(match.element)
        ? FRAME_STYLE.nameFontSize
        : match.element.fontSize,
      fontFamily: isFrameLikeElement(match.element)
        ? FONT_FAMILY.Assistant
        : match.element.fontFamily,
    });

    const FONT_SIZE_LEGIBILITY_THRESHOLD = 14;

    const fontSize = matchAsElement.fontSize;
    const isTextTiny = fontSize * zoomValue < FONT_SIZE_LEGIBILITY_THRESHOLD;

    if (
      !isElementCompletelyInViewport(
        [matchAsElement],
        app.canvas.width / window.devicePixelRatio,
        app.canvas.height / window.devicePixelRatio,
        {
          offsetLeft: app.state.offsetLeft,
          offsetTop: app.state.offsetTop,
          scrollX: app.state.scrollX,
          scrollY: app.state.scrollY,
          zoom: app.state.zoom,
        },
        app.scene.getNonDeletedElementsMap(),
        app.viewport.getOffsets(),
      ) ||
      isTextTiny
    ) {
      // tiny, illegible text fills the viewport so it becomes readable;
      // otherwise just fit the match into view (capped at 100%)
      const behavior =
        isTextTiny && fontSize < FONT_SIZE_LEGIBILITY_THRESHOLD
          ? "contain"
          : "scale-down";

      app.viewport.setViewport({
        target: getCommonBounds([matchAsElement]),
        fit: behavior,
        animation: { duration: 300 },
        offsets: { ui: true },
      });
    }
  }

  /**
   * Upstream scrolls the highlighted result into the list's view from the
   * `ListItem`'s ref callback; Angular has no per-render ref hook, so the
   * active item is looked up after the state update that highlighted it
   * (the editor's `setState` runs change detection synchronously).
   */
  private scrollResultItemIntoView() {
    const element =
      this.editor.excalidrawContainerValue.container?.querySelector(
        ".layer-ui__result-item.active",
      );
    element?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }

  private handleKeyDown(event: KeyboardEvent) {
    const app = this.editor;

    if (
      event.key === KEYS.ESCAPE &&
      !app.state.openDialog &&
      !app.state.openPopup
    ) {
      event.preventDefault();
      event.stopPropagation();
      app.batchCommits(() => app.setState({ openSidebar: null }));
      return;
    }

    if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.F) {
      event.preventDefault();
      event.stopPropagation();

      if (app.state.openDialog) {
        return;
      }

      const searchInput = this.textField()?.inputElement;

      if (!searchInput?.matches(":focus")) {
        searchInput?.focus();
        searchInput?.select();
      }
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".layer-ui__search")
    ) {
      if (this.searchMatches().items.length) {
        if (event.key === KEYS.ENTER) {
          event.stopPropagation();
          this.goToNextItem();
        }

        if (event.key === KEYS.ARROW_UP) {
          event.stopPropagation();
          this.goToPreviousItem();
        } else if (event.key === KEYS.ARROW_DOWN) {
          event.stopPropagation();
          this.goToNextItem();
        }
      }
    }
  }
}

const getMatchPreview = (
  text: string,
  index: number,
  searchQuery: SearchQuery,
) => {
  const WORDS_BEFORE = 2;
  const WORDS_AFTER = 5;

  const substrBeforeQuery = text.slice(0, index);
  const wordsBeforeQuery = substrBeforeQuery.split(/\s+/);
  // text = "small", query = "mall", not complete before
  // text = "small", query = "smal", complete before
  const isQueryCompleteBefore = substrBeforeQuery.endsWith(" ");
  const startWordIndex =
    wordsBeforeQuery.length -
    WORDS_BEFORE -
    1 -
    (isQueryCompleteBefore ? 0 : 1);
  let wordsBeforeAsString =
    wordsBeforeQuery.slice(startWordIndex <= 0 ? 0 : startWordIndex).join(" ") +
    (isQueryCompleteBefore ? " " : "");

  const MAX_ALLOWED_CHARS = 20;

  wordsBeforeAsString =
    wordsBeforeAsString.length > MAX_ALLOWED_CHARS
      ? wordsBeforeAsString.slice(-MAX_ALLOWED_CHARS)
      : wordsBeforeAsString;

  const substrAfterQuery = text.slice(index + searchQuery.length);
  const wordsAfter = substrAfterQuery.split(/\s+/);
  // text = "small", query = "mall", complete after
  // text = "small", query = "smal", not complete after
  const isQueryCompleteAfter = !substrAfterQuery.startsWith(" ");
  const numberOfWordsToTake = isQueryCompleteAfter
    ? WORDS_AFTER + 1
    : WORDS_AFTER;
  const wordsAfterAsString =
    (isQueryCompleteAfter ? "" : " ") +
    wordsAfter.slice(0, numberOfWordsToTake).join(" ");

  return {
    indexInSearchQuery: wordsBeforeAsString.length,
    previewText: wordsBeforeAsString + searchQuery + wordsAfterAsString,
    moreBefore: startWordIndex > 0,
    moreAfter: wordsAfter.length > numberOfWordsToTake,
  };
};

const normalizeWrappedText = (
  wrappedText: string,
  originalText: string,
): string => {
  const wrappedLines = wrappedText.split("\n");
  const normalizedLines: string[] = [];
  let originalIndex = 0;

  for (let i = 0; i < wrappedLines.length; i++) {
    let currentLine = wrappedLines[i];
    const nextLine = wrappedLines[i + 1];

    if (nextLine) {
      const nextLineIndexInOriginal = originalText.indexOf(
        nextLine,
        originalIndex,
      );

      if (nextLineIndexInOriginal > currentLine.length + originalIndex) {
        let j = nextLineIndexInOriginal - (currentLine.length + originalIndex);

        while (j > 0) {
          currentLine += " ";
          j--;
        }
      }
    }

    normalizedLines.push(currentLine);
    originalIndex = originalIndex + currentLine.length;
  }

  return normalizedLines.join("\n");
};

const getMatchedLines = (
  textElement: ExcalidrawTextElement,
  searchQuery: SearchQuery,
  index: number,
) => {
  const normalizedText = normalizeWrappedText(
    textElement.text,
    textElement.originalText,
  );

  const lines = normalizedText.split("\n");

  const lineIndexRanges = [];
  let currentIndex = 0;
  let lineNumber = 0;

  for (const line of lines) {
    const startIndex = currentIndex;
    const endIndex = startIndex + line.length - 1;

    lineIndexRanges.push({
      line,
      startIndex,
      endIndex,
      lineNumber,
    });

    // Move to the next line's start index
    currentIndex = endIndex + 1;
    lineNumber++;
  }

  let startIndex = index;
  let remainingQuery = textElement.originalText.slice(
    index,
    index + searchQuery.length,
  );
  const matchedLines: SearchMatch["matchedLines"] = [];

  for (const lineIndexRange of lineIndexRanges) {
    if (remainingQuery === "") {
      break;
    }

    if (
      startIndex >= lineIndexRange.startIndex &&
      startIndex <= lineIndexRange.endIndex
    ) {
      const matchCapacity = lineIndexRange.endIndex + 1 - startIndex;
      const textToStart = lineIndexRange.line.slice(
        0,
        startIndex - lineIndexRange.startIndex,
      );

      const matchedWord = remainingQuery.slice(0, matchCapacity);
      remainingQuery = remainingQuery.slice(matchCapacity);

      const offset = measureText(
        textToStart,
        getFontString(textElement),
        textElement.lineHeight,
      );

      // measureText returns a non-zero width for the empty string
      // which is not what we're after here, hence the check and the correction
      if (textToStart === "") {
        offset.width = 0;
      }

      if (textElement.textAlign !== "left" && lineIndexRange.line.length > 0) {
        const lineLength = measureText(
          lineIndexRange.line,
          getFontString(textElement),
          textElement.lineHeight,
        );

        const spaceToStart =
          textElement.textAlign === "center"
            ? (textElement.width - lineLength.width) / 2
            : textElement.width - lineLength.width;
        offset.width += spaceToStart;
      }

      const { width, height } = measureText(
        matchedWord,
        getFontString(textElement),
        textElement.lineHeight,
      );

      const offsetX = offset.width;
      const offsetY = lineIndexRange.lineNumber * offset.height;

      matchedLines.push({
        offsetX,
        offsetY,
        width,
        height,
        showOnCanvas: true,
      });

      startIndex += matchCapacity;
    }
  }

  return matchedLines;
};

const getMatchInFrame = (
  frame: ExcalidrawFrameLikeElement,
  searchQuery: SearchQuery,
  index: number,
  zoomValue: number,
): SearchMatch["matchedLines"] => {
  const text = frame.name ?? getDefaultFrameName(frame);
  const matchedText = text.slice(index, index + searchQuery.length);

  const prefixText = text.slice(0, index);
  const font = getFontString({
    fontSize: FRAME_STYLE.nameFontSize,
    fontFamily: FONT_FAMILY.Assistant,
  });

  const lineHeight = getLineHeight(FONT_FAMILY.Assistant);

  const offset = measureText(prefixText, font, lineHeight);

  // Correct non-zero width for empty string
  if (prefixText === "") {
    offset.width = 0;
  }

  const matchedMetrics = measureText(matchedText, font, lineHeight);

  const offsetX = offset.width;
  const offsetY = -offset.height - FRAME_STYLE.strokeWidth;
  const width = matchedMetrics.width;

  return [
    {
      offsetX,
      offsetY,
      width,
      height: matchedMetrics.height,
      showOnCanvas: offsetX + width <= frame.width * zoomValue,
    },
  ];
};

const escapeSpecialCharacters = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
};

const handleSearch = debounce(
  (
    searchQuery: SearchQuery,
    app: CaliburnEditorComponent,
    cb: (matchItems: SearchMatchItem[], focusIndex: number | null) => void,
  ) => {
    if (!searchQuery || searchQuery === "") {
      cb([], null);
      return;
    }

    const elements = app.scene.getNonDeletedElements();
    const texts = elements.filter((el) =>
      isTextElement(el),
    ) as ExcalidrawTextElement[];

    const frames = elements.filter((el) =>
      isFrameLikeElement(el),
    ) as ExcalidrawFrameLikeElement[];

    texts.sort((a, b) => a.y - b.y);
    frames.sort((a, b) => a.y - b.y);

    const textMatches: SearchMatchItem[] = [];

    const regex = new RegExp(escapeSpecialCharacters(searchQuery), "gi");

    for (const textEl of texts) {
      let match = null;
      const text = textEl.originalText;

      while ((match = regex.exec(text)) !== null) {
        const preview = getMatchPreview(text, match.index, searchQuery);
        const matchedLines = getMatchedLines(textEl, searchQuery, match.index);

        if (matchedLines.length > 0) {
          textMatches.push({
            element: textEl,
            searchQuery,
            preview,
            index: match.index,
            matchedLines,
          });
        }
      }
    }

    const frameMatches: SearchMatchItem[] = [];

    for (const frame of frames) {
      let match = null;
      const name = frame.name ?? getDefaultFrameName(frame);

      while ((match = regex.exec(name)) !== null) {
        const preview = getMatchPreview(name, match.index, searchQuery);
        const matchedLines = getMatchInFrame(
          frame,
          searchQuery,
          match.index,
          app.state.zoom.value,
        );

        if (matchedLines.length > 0) {
          frameMatches.push({
            element: frame,
            searchQuery,
            preview,
            index: match.index,
            matchedLines,
          });
        }
      }
    }

    const visibleIds = new Set(
      app.visibleElements.map((visibleElement) => visibleElement.id),
    );

    // putting frame matches first
    const matchItems: SearchMatchItem[] = [...frameMatches, ...textMatches];

    const focusIndex =
      matchItems.findIndex((matchItem) =>
        visibleIds.has(matchItem.element.id),
      ) ?? null;

    cb(matchItems, focusIndex);
  },
  SEARCH_DEBOUNCE,
);
