import { KNOWN_BROKEN } from "../known-broken.mjs";

import { collectEvidence } from "./browser.mjs";

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) =>
  COLOR ? `\u001b[${code}m${text}\u001b[0m` : text;
const green = (t) => paint("32", t);
const red = (t) => paint("31", t);
const yellow = (t) => paint("33", t);
const dim = (t) => paint("2", t);
const bold = (t) => paint("1", t);

/** ids listed here run strict even though `known-broken.mjs` excuses them —
 * `E2E_STRICT=palette.solid-background,help.close-via-button` or `E2E_STRICT=all` */
const strictOverrides = (() => {
  const raw = process.env.E2E_STRICT?.trim();
  if (!raw) {
    return new Set();
  }
  if (raw === "all") {
    return "all";
  }
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
})();

const isExcused = (id) =>
  Object.hasOwn(KNOWN_BROKEN, id) &&
  strictOverrides !== "all" &&
  !strictOverrides.has(id);

export class Runner {
  results = [];
  #group = null;
  #printedLayers = new Set();

  group(name) {
    this.#group = name;
    console.log(`\n${bold(name)}`);
  }

  /**
   * Runs one check. `fn` throws (or calls `expect*`) to fail. A check listed
   * in KNOWN_BROKEN records as `known-broken` when it fails and `unexpected
   * pass` when it succeeds; neither fails the run, so today's suite is green
   * while every defect stays visible in the table.
   *
   * `evidence: { page, selectors }` names the DOM nodes this check's defect
   * lives at. On any failure they are probed while the page is still open, and
   * `report()` prints the mount point, computed styles and hit-test winner —
   * so the run's own output, not a one-off investigation, is what a fix task
   * works from.
   */
  async check(id, title, fn, { evidence } = {}) {
    const excused = isExcused(id);
    const started = Date.now();
    let error = null;
    try {
      await fn();
    } catch (thrown) {
      error = thrown;
    }
    const ms = Date.now() - started;
    const status = error
      ? excused
        ? "known-broken"
        : "fail"
      : excused
      ? "xpass"
      : "pass";

    let gathered = null;
    if (error && evidence?.page) {
      const selectors = [
        ...new Set([...(evidence.selectors ?? []), ...(error.selectors ?? [])]),
      ];
      if (selectors.length) {
        gathered = await collectEvidence(evidence.page, selectors).catch(
          (thrown) => [{ selector: "(all)", error: thrown.message }],
        );
      }
    }

    this.results.push({
      id,
      title,
      group: this.#group,
      status,
      ms,
      detail: error ? String(error.message).split("\n")[0] : null,
      stack: error?.stack ?? null,
      note: excused ? KNOWN_BROKEN[id] : null,
      evidence: gathered,
    });

    const badge = {
      pass: green("  PASS"),
      fail: red("  FAIL"),
      "known-broken": yellow(" XFAIL"),
      xpass: yellow(" XPASS"),
    }[status];
    console.log(`${badge} ${title} ${dim(`(${id}, ${ms}ms)`)}`);
    if (error) {
      console.log(
        `        ${dim(String(error.message).split("\n").join("\n        "))}`,
      );
    }
    if (status === "xpass") {
      console.log(
        `        ${dim(
          "listed in KNOWN_BROKEN but passed — promote it to strict",
        )}`,
      );
    }
    return status;
  }

  /**
   * The mount point / computed styles / hit-test winner block. Printed for
   * every failing and expected-failing check so the run's stdout carries the
   * full DOM evidence for the defect.
   */
  #printEvidence(result, indent = "    ") {
    if (!result.evidence?.length) {
      return;
    }
    for (const item of result.evidence) {
      console.log(`${indent}${bold("evidence")} ${item.selector}`);
      if (item.error) {
        console.log(`${indent}  could not probe: ${item.error}`);
        continue;
      }
      const { probe, occlusion, ancestry } = item;
      if (!probe?.found) {
        console.log(`${indent}  not in the DOM`);
        continue;
      }
      console.log(
        `${indent}  box       x=${probe.rect.x} y=${probe.rect.y} w=${probe.rect.width} h=${probe.rect.height}`,
      );
      console.log(
        `${indent}  computed  position:${probe.position} z-index:${probe.zIndex} background-color:${probe.backgroundColor} opacity:${probe.opacity} pointer-events:${probe.pointerEvents} visibility:${probe.visibility}`,
      );
      if (occlusion?.found) {
        console.log(
          `${indent}  hit-test  at [${occlusion.point}] topmost=${occlusion.topmost} owns=${occlusion.ownsPoint}`,
        );
        console.log(
          `${indent}            stack: ${occlusion.stack.join(" > ")}`,
        );
      }
      if (ancestry?.found) {
        console.log(`${indent}  mounted at`);
        for (const [i, node] of ancestry.chain.entries()) {
          console.log(
            `${indent}    ${i === 0 ? " " : "<"} ${node.node} [position:${
              node.position
            } z-index:${node.zIndex} opacity:${node.opacity} transform:${
              node.transform
            } isolation:${node.isolation}]`,
          );
        }
        // the paint-order tables repeat across every overlay defect; print
        // each distinct one once and refer back to it afterwards
        const layerTable = (label, rows) => {
          if (!rows.length) {
            return;
          }
          const key = `${label}\n${rows.join("\n")}`;
          if (this.#printedLayers.has(key)) {
            console.log(`${indent}  layers inside ${label} — as printed above`);
            return;
          }
          this.#printedLayers.add(key);
          console.log(`${indent}  layers inside ${label} (paint order)`);
          for (const row of rows) {
            console.log(`${indent}    ${row}`);
          }
        };
        layerTable(ancestry.hostLayerName, ancestry.hostLayers);
        layerTable(".excalidraw", ancestry.layers);
      }
    }
  }

  /**
   * A typo'd `E2E_STRICT` id promotes nothing while the run still exits 0 —
   * a false green, which is the one failure mode a gate cannot have. A stale
   * `KNOWN_BROKEN` key silently excuses nothing. Both are hard errors.
   */
  #unclaimedIds() {
    const executed = new Set(this.results.map((r) => r.id));
    const problems = [];
    for (const id of Object.keys(KNOWN_BROKEN)) {
      if (!executed.has(id)) {
        problems.push(`KNOWN_BROKEN key "${id}" matches no check`);
      }
    }
    if (strictOverrides !== "all") {
      for (const id of strictOverrides) {
        if (!executed.has(id)) {
          problems.push(`E2E_STRICT id "${id}" matches no check`);
        }
      }
    }
    return problems;
  }

  /** `partial` = the run died part-way, so "no check claimed this id" is a
   * consequence of the crash rather than a stale id */
  report({ partial = false } = {}) {
    const by = (status) => this.results.filter((r) => r.status === status);
    const pass = by("pass");
    const fail = by("fail");
    const broken = by("known-broken");
    const xpass = by("xpass");
    const unclaimed = partial ? [] : this.#unclaimedIds();

    if (!this.results.length) {
      console.log(`\n${red("no checks ran")}`);
      return false;
    }

    const width = Math.max(...this.results.map((r) => r.id.length), 4);
    console.log(`\n${bold("check table")}`);
    console.log(dim("-".repeat(width + 60)));
    for (const r of this.results) {
      const label = {
        pass: green("strict-pass  "),
        fail: red("FAIL         "),
        "known-broken": yellow("known-broken "),
        xpass: yellow("unexpect-pass"),
      }[r.status];
      console.log(
        `${label} ${r.id.padEnd(width)}  ${
          r.detail ? dim(r.detail.slice(0, 90)) : ""
        }`,
      );
    }
    console.log(dim("-".repeat(width + 60)));

    if (broken.length) {
      console.log(
        `\n${bold(
          "KNOWN_BROKEN (expected failures — each fix task flips its entry to strict)",
        )}`,
      );
      for (const r of broken) {
        console.log(`  ${yellow(r.id)}`);
        console.log(`    why:      ${r.note}`);
        console.log(`    observed: ${r.detail}`);
        this.#printEvidence(r);
      }
    }
    if (xpass.length) {
      console.log(
        `\n${yellow(
          "UNEXPECTED PASSES",
        )} — remove these from known-broken.mjs:`,
      );
      for (const r of xpass) {
        console.log(`  ${r.id}`);
      }
    }
    if (fail.length) {
      console.log(`\n${red("FAILURES")}`);
      for (const r of fail) {
        console.log(`  ${red(r.id)}: ${r.detail}`);
        if (r.stack) {
          console.log(dim(r.stack.split("\n").slice(1, 4).join("\n")));
        }
        this.#printEvidence(r);
      }
    }

    if (unclaimed.length) {
      console.log(`\n${red("STALE IDS")} — the run cannot be trusted:`);
      for (const problem of unclaimed) {
        console.log(`  ${red(problem)}`);
      }
    }

    console.log(
      `\n${bold("summary")}: ${green(`${pass.length} strict pass`)}, ${yellow(
        `${broken.length} known-broken`,
      )}, ${yellow(`${xpass.length} unexpected pass`)}, ${
        fail.length ? red(`${fail.length} FAIL`) : `${fail.length} fail`
      }${unclaimed.length ? red(`, ${unclaimed.length} STALE ID`) : ""}`,
    );
    if (strictOverrides === "all") {
      console.log(
        dim("(E2E_STRICT=all — every known-broken entry ran strict)"),
      );
    } else if (strictOverrides.size) {
      console.log(dim(`(E2E_STRICT=${[...strictOverrides].join(",")})`));
    }
    return fail.length === 0 && unclaimed.length === 0;
  }
}

export const expect = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

export const expectEqual = (actual, expected, what) => {
  if (actual !== expected) {
    throw new Error(
      `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(
        actual,
      )}`,
    );
  }
};
