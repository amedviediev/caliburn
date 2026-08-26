/**
 * Release gate: consume the published tarball exactly as an Angular
 * application does — a real `npm install` of the packed artifact into a
 * scratch Angular CLI workspace, then a real `ng build`.
 *
 * The monorepo cannot catch packaging defects on its own: `caliburn-app`
 * reaches the library through the tsconfig path alias, so it never exercises
 * the exports map, the emitted declarations, or the dependency list. Anything
 * this script does not compile, a consumer cannot compile either.
 *
 * It has to be the Angular CLI (`@angular/build` + ngtsc), not a Vite build:
 * only ngtsc validates that a class placed in a component's `imports` carries
 * standalone component metadata in its `.d.ts`.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const rootManifest = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
);
// Pin the fixture to the Angular the workspace develops against, so a gate
// failure is always the package's fault rather than a version drift.
const angularVersion = rootManifest.devDependencies["@angular/core"];
const typescriptVersion = rootManifest.devDependencies.typescript;
const rxjsVersion = rootManifest.devDependencies.rxjs;

const fixtureRoot = mkdtempSync(join(tmpdir(), "ngx-caliburn-consumer-"));
// npm's cache is the slow part of a cold fixture; keeping it outside the
// scratch directory makes repeat runs cheap.
const npmCache = join(tmpdir(), "ngx-caliburn-consumer-npm-cache");

const writeFixture = (path, contents) => {
  const target = join(fixtureRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

const writeJsonFixture = (path, value) =>
  writeFixture(path, `${JSON.stringify(value, null, 2)}\n`);

const run = (command, args, cwd = fixtureRoot) =>
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, npm_config_cache: npmCache },
  });

try {
  const packOutput = execFileSync(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", fixtureRoot],
    {
      cwd: packageRoot,
      encoding: "utf8",
      env: { ...process.env, npm_config_cache: npmCache },
    },
  );
  const [{ filename }] = JSON.parse(packOutput);

  writeJsonFixture("package.json", {
    name: "ngx-caliburn-angular-consumer",
    version: "0.0.0",
    private: true,
    // Only the declared peers plus the tarball: everything else the library
    // needs has to arrive through its own `dependencies`.
    dependencies: {
      "@angular/common": angularVersion,
      "@angular/compiler": angularVersion,
      "@angular/core": angularVersion,
      "@angular/platform-browser": angularVersion,
      "ngx-caliburn": `file:./${filename}`,
      rxjs: rxjsVersion,
    },
    devDependencies: {
      "@angular/build": angularVersion,
      "@angular/cli": angularVersion,
      "@angular/compiler-cli": angularVersion,
      typescript: typescriptVersion,
    },
  });

  writeJsonFixture("angular.json", {
    version: 1,
    projects: {
      consumer: {
        projectType: "application",
        root: "",
        sourceRoot: "src",
        architect: {
          build: {
            builder: "@angular/build:application",
            options: {
              outputPath: "dist",
              index: "src/index.html",
              browser: "src/main.ts",
              tsConfig: "tsconfig.app.json",
              // The stylesheet ships as a subpath export; a consumer wires it
              // through `styles`, which resolves it from node_modules.
              styles: ["node_modules/ngx-caliburn/dist/index.css"],
            },
          },
        },
      },
    },
  });

  writeJsonFixture("tsconfig.app.json", {
    compilerOptions: {
      target: "ES2022",
      module: "preserve",
      moduleResolution: "bundler",
      strict: true,
      // What the Angular CLI generates for a new application; a consumer with
      // `skipLibCheck: false` is a stricter case the package does not promise.
      skipLibCheck: true,
      experimentalDecorators: true,
      types: [],
    },
    angularCompilerOptions: { strictTemplates: true },
    files: ["src/main.ts"],
  });

  writeFixture(
    "src/index.html",
    '<!doctype html>\n<html>\n  <head><meta charset="utf-8" /><title>consumer</title></head>\n  <body><app-root></app-root></body>\n</html>\n',
  );

  writeFixture(
    "src/main.ts",
    `import { Component, provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import { CaliburnEditorComponent } from "ngx-caliburn";
import { arrayToMap } from "ngx-caliburn/common";
import { reconcileElements } from "ngx-caliburn/data/reconcile";
import { restoreElements } from "ngx-caliburn/data/restore";
import { serializeAsJSON } from "ngx-caliburn/data/json";
import { getSceneVersion } from "ngx-caliburn/element";
import { pointFrom } from "ngx-caliburn/math";

import type { OrderedExcalidrawElement } from "ngx-caliburn/element/types";
import type { AppState } from "ngx-caliburn/types";

// The vendored subpaths a collaborative host reaches for. Referenced rather
// than merely imported so the bundler has to resolve them instead of dropping
// the imports as unused.
export const collaborationSurface = (
  local: readonly OrderedExcalidrawElement[],
  remote: readonly OrderedExcalidrawElement[],
  appState: AppState,
) => ({
  reconciled: reconcileElements(local, remote as never, appState),
  restored: restoreElements(remote, null),
  version: getSceneVersion(local),
  serialized: serializeAsJSON(local, appState, {}, "local"),
  index: arrayToMap(local),
  origin: pointFrom(0, 0),
});

@Component({
  selector: "app-root",
  imports: [CaliburnEditorComponent],
  template: \`<div style="height: 100vh"><caliburn-editor /></div>\`,
})
export class AppComponent {}

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
});
`,
  );

  run("npm", ["install", "--no-audit", "--no-fund"]);

  // React must not reach a consumer's tree at all. npm hoists, so anything
  // that pulled React in transitively lands here — as `jotai-scope` used to.
  if (existsSync(join(fixtureRoot, "node_modules/react"))) {
    throw new Error("react was installed into the consumer's dependency tree");
  }

  run(join(fixtureRoot, "node_modules/.bin/ng"), ["build"]);

  if (!existsSync(join(fixtureRoot, "dist/browser/index.html"))) {
    throw new Error("Consumer build did not emit the Angular application");
  }

  process.stdout.write(
    "\nConsumer build succeeded — the package is installable.\n",
  );
} catch (error) {
  // The failing command has already written its own diagnostics to stderr; a
  // Node stack trace over the top of them only buries the compiler error.
  console.error(`\nConsumer gate failed: ${error.message.split("\n")[0]}`);
  process.exitCode = 1;
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}
