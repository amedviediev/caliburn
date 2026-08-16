import { KNOWN_BROKEN } from "../known-broken.mjs";

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

  group(name) {
    this.#group = name;
    console.log(`\n${bold(name)}`);
  }

  /**
   * Runs one check. `fn` throws (or calls `expect*`) to fail. A check listed
   * in KNOWN_BROKEN records as `known-broken` when it fails and `unexpected
   * pass` when it succeeds; neither fails the run, so today's suite is green
   * while every defect stays visible in the table.
   */
  async check(id, title, fn) {
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

    this.results.push({
      id,
      title,
      group: this.#group,
      status,
      ms,
      detail: error ? String(error.message).split("\n")[0] : null,
      stack: error?.stack ?? null,
      note: excused ? KNOWN_BROKEN[id] : null,
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

  report() {
    const by = (status) => this.results.filter((r) => r.status === status);
    const pass = by("pass");
    const fail = by("fail");
    const broken = by("known-broken");
    const xpass = by("xpass");

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
      }
    }

    console.log(
      `\n${bold("summary")}: ${green(`${pass.length} strict pass`)}, ${yellow(
        `${broken.length} known-broken`,
      )}, ${yellow(`${xpass.length} unexpected pass`)}, ${
        fail.length ? red(`${fail.length} FAIL`) : `${fail.length} fail`
      }`,
    );
    if (strictOverrides === "all") {
      console.log(
        dim("(E2E_STRICT=all — every known-broken entry ran strict)"),
      );
    } else if (strictOverrides.size) {
      console.log(dim(`(E2E_STRICT=${[...strictOverrides].join(",")})`));
    }
    return fail.length === 0;
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
