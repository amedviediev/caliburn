import { ChangeDetectionStrategy, Component } from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

/** the anchors upstream's `<Trans>` fills in for the `<link>` /
 * `<issueLink>` / `<discordLink>` markers */
const LINKS: Record<string, string> = {
  link: "http://docs.excalidraw.com/docs/@excalidraw/excalidraw/faq#turning-off-aggresive-block-fingerprinting-in-brave-browser",
  issueLink: "https://github.com/excalidraw/excalidraw/issues/new",
  discordLink: "https://discord.gg/UexuTaE",
};

/** upstream renders the discord anchor as `{el}.` — the trailing period is
 * part of the link text, not of the sentence around it */
const SUFFIXES: Record<string, string> = { discordLink: "." };

type Run = { text: string; href: string | null; bold: boolean };

const parseLine = (raw: string): Run[] => {
  const runs: Run[] = [];
  const marker = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;
  let match = marker.exec(raw);

  while (match !== null) {
    if (match.index > lastIndex) {
      runs.push({
        text: raw.slice(lastIndex, match.index),
        href: null,
        bold: false,
      });
    }
    const name = match[1];
    runs.push({
      text: `${match[2]}${SUFFIXES[name] ?? ""}`,
      href: LINKS[name] ?? null,
      bold: name === "bold",
    });
    lastIndex = marker.lastIndex;
    match = marker.exec(raw);
  }
  if (lastIndex < raw.length) {
    runs.push({ text: raw.slice(lastIndex), href: null, bold: false });
  }

  return runs;
};

/**
 * Angular port of upstream `BraveMeasureTextError.tsx` — the message the
 * error dialog shows when Brave's aggressive fingerprinting protection
 * breaks `measureText`. Upstream composes each line with `<Trans>`; caliburn
 * has no `Trans` port, so each line's markers are parsed into runs the same
 * way the Mermaid dialog's description is
 * (`ttd-dialog/mermaid-to-excalidraw.component.ts`).
 */
@Component({
  selector: "caliburn-brave-measure-text-error",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./brave-measure-text-error.component.html",
})
export class CaliburnBraveMeasureTextErrorComponent {
  protected readonly lines = [
    parseLine(t("errors.brave_measure_text_error.line1")),
    parseLine(t("errors.brave_measure_text_error.line2")),
    parseLine(t("errors.brave_measure_text_error.line3")),
    parseLine(t("errors.brave_measure_text_error.line4")),
  ];
}
