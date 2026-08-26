import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "ngx-caliburn-consumer-"));
const fixtureNodeModules = join(temporaryRoot, "node_modules");

const writeFixture = (path, contents) => {
  const target = join(temporaryRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

try {
  const packOutput = execFileSync(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", temporaryRoot],
    {
      cwd: packageRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_cache: join(temporaryRoot, "npm-cache"),
      },
    },
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = join(temporaryRoot, filename);
  const installedPackage = join(fixtureNodeModules, "ngx-caliburn");

  mkdirSync(installedPackage, { recursive: true });
  execFileSync(
    "tar",
    ["-xzf", tarball, "--strip-components=1", "-C", installedPackage],
    { stdio: "inherit" },
  );

  const repositoryNodeModules = join(repositoryRoot, "node_modules");
  for (const entry of readdirSync(repositoryNodeModules)) {
    if (entry === ".bin" || entry === "ngx-caliburn") {
      continue;
    }
    symlinkSync(
      join(repositoryNodeModules, entry),
      join(fixtureNodeModules, entry),
      "junction",
    );
  }

  writeFixture(
    "package.json",
    `${JSON.stringify(
      { name: "ngx-caliburn-consumer", private: true, type: "module" },
      null,
      2,
    )}\n`,
  );
  writeFixture(
    "index.html",
    '<!doctype html><html><body><app-root></app-root><script type="module" src="/src/main.ts"></script></body></html>\n',
  );
  writeFixture(
    "tsconfig.json",
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          useDefineForClassFields: false,
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: false,
          experimentalDecorators: true,
          // a Vite consumer's ambient declarations, needed for the CSS
          // side-effect import
          types: ["vite/client"],
        },
        angularCompilerOptions: { strictTemplates: true },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );
  writeFixture(
    "vite.config.mts",
    `import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [angular({ jit: false, tsconfig: "./tsconfig.json" })],
});
`,
  );
  writeFixture(
    "src/main.ts",
    `import "ngx-caliburn/index.css";

import { Component, provideZonelessChangeDetection } from "@angular/core";
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

// the vendored subpaths a collaborative host reaches for; referenced so the
// bundler has to resolve them rather than drop the imports
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
  standalone: true,
  imports: [CaliburnEditorComponent],
  template: '<div style="height: 100vh"><caliburn-editor /></div>',
})
class AppComponent {}

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
});
`,
  );

  // `vite build` never typechecks, so the exports map's "types" conditions
  // would go unverified without a separate tsc pass over the same fixture.
  const typescriptBin = join(repositoryRoot, "node_modules/typescript/bin/tsc");
  execFileSync(process.execPath, [typescriptBin, "-p", ".", "--noEmit"], {
    cwd: temporaryRoot,
    stdio: "inherit",
  });

  const viteBin = join(repositoryRoot, "node_modules/vite/bin/vite.js");
  execFileSync(process.execPath, [viteBin, "build"], {
    cwd: temporaryRoot,
    stdio: "inherit",
  });

  const builtIndex = readFileSync(
    join(temporaryRoot, "dist/index.html"),
    "utf8",
  );
  if (!builtIndex.includes("app-root")) {
    throw new Error("Consumer build did not emit the Angular application");
  }
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
