import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(packageRoot, "dist");
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
);

const walkFiles = (root, extension) => {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory()
      ? walkFiles(path, extension)
      : !extension || extname(path) === extension
      ? [path]
      : [];
  });
};

const readAll = (files) =>
  files.map((file) => readFileSync(file, "utf8")).join("\n");

// Node walks node_modules upward from the importer; dist lives inside the
// workspace, so the dependency may be hoisted to the repository root.
const resolveDependency = (packageName) => {
  let directory = distRoot;
  for (;;) {
    const candidate = join(directory, "node_modules", packageName);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
};

const packageNameFromSpecifier = (specifier) =>
  specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];

test("manifest exposes the public release contract", () => {
  assert.equal(manifest.name, "ngx-caliburn");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.notEqual(manifest.private, true);
  assert.deepEqual(manifest.files, ["dist", "README.md", "LICENSE"]);
  assert.equal(manifest.exports["."].types, "./dist/types/index.d.ts");
  assert.equal(manifest.exports["."].import, "./dist/index.js");
  assert.equal(manifest.exports["./index.css"], "./dist/index.css");
  assert.equal(manifest.publishConfig.access, "public");
});

test("every exports subpath resolves to emitted files", () => {
  const conditionTargets = (entry) =>
    typeof entry === "string" ? [entry] : Object.values(entry);

  for (const [subpath, entry] of Object.entries(manifest.exports)) {
    if (subpath === "./package.json") {
      continue;
    }

    for (const target of conditionTargets(entry)) {
      assert.ok(
        existsSync(join(packageRoot, target)),
        `exports["${subpath}"] points at missing ${target}`,
      );
    }
  }
});

test("vendored subpath entries re-export runtime values", () => {
  // A wildcard mapping every subpath onto the root bundle would resolve here
  // too, so assert the emitted entry actually carries the named exports.
  const expected = {
    "./data/reconcile": ["reconcileElements", "shouldDiscardRemoteElement"],
    "./data/restore": ["restoreAppState", "restoreElements"],
    "./data/encryption": ["decryptData", "encryptData"],
    "./data/encode": ["compressData", "decompressData"],
    "./data/json": ["serializeAsJSON", "serializeLibraryAsJSON"],
    "./data/blob": ["getDataURL", "loadFromBlob"],
    "./element": ["CaptureUpdateAction", "getSceneVersion", "newElementWith"],
    "./common": ["arrayToMap", "randomId"],
    "./math": ["pointFrom", "pointDistance"],
    "./utils": ["exportToBlob", "exportToSvg"],
  };

  for (const [subpath, names] of Object.entries(expected)) {
    const source = readFileSync(
      join(packageRoot, manifest.exports[subpath].import),
      "utf8",
    );
    const exported = new Set(
      [...source.matchAll(/(?:^|[,{])\s*\w+ as (\w+)/g)].map(
        (match) => match[1],
      ),
    );

    for (const name of names) {
      assert.ok(exported.has(name), `${subpath} does not export ${name}`);
    }
  }
});

test("manifest records the vendored Excalidraw snapshot", () => {
  // The core packages are bundled into dist rather than resolved from npm, so
  // the upstream pin lives here instead of in the dependency range.
  assert.match(manifest.excalidraw.version, /^\d+\.\d+\.\d+$/);
  assert.match(manifest.excalidraw.commit, /^[0-9a-f]{40}$/);

  const bundled = [
    "@excalidraw/common",
    "@excalidraw/element",
    "@excalidraw/math",
    "@excalidraw/utils",
    "@excalidraw/laser-pointer",
  ];
  for (const packageName of bundled) {
    assert.equal(
      packageName in (manifest.dependencies ?? {}),
      false,
      `${packageName} is bundled and must not be a dependency`,
    );
  }
});

test("build emits JavaScript, CSS, declarations, and fonts", () => {
  const requiredFiles = ["index.js", "index.css", join("types", "index.d.ts")];

  for (const file of requiredFiles) {
    assert.ok(existsSync(join(distRoot, file)), `missing dist/${file}`);
  }

  const fonts = walkFiles(distRoot, ".woff2");
  assert.ok(fonts.length > 0, "missing emitted .woff2 font assets");

  const indexJavaScript = readFileSync(join(distRoot, "index.js"), "utf8");
  const relativeImports = [
    ...indexJavaScript.matchAll(/(?:from\s*|import\s*\()["'](\.[^"']+)["']/g),
  ].map((match) => match[1]);

  for (const specifier of relativeImports) {
    const target = resolve(distRoot, specifier);
    assert.ok(
      existsSync(target),
      `index.js references missing chunk ${specifier}`,
    );
  }
});

test("runtime bundle contains no React or private Excalidraw imports", () => {
  const javaScriptFiles = walkFiles(distRoot, ".js");
  assert.ok(javaScriptFiles.length > 0, "missing emitted JavaScript");
  const javaScript = readAll(javaScriptFiles);

  // `import "react"` — a bare side-effect import, which is what Rollup leaves
  // behind when a vendored module's React bindings all tree-shake away — has
  // no `from` and no parenthesis, so it has to be matched on its own.
  assert.doesNotMatch(
    javaScript,
    /(?:\bfrom\s*|\bimport\s*\(?\s*)["']react(?:\/[^"']*)?["']/,
  );
  assert.doesNotMatch(
    javaScript,
    /["']@excalidraw\/excalidraw(?:\/[^"']*)?["']/,
  );
});

test("runtime bundle reads browser-only globals off globalThis", () => {
  const javaScriptFiles = walkFiles(distRoot, ".js");
  assert.ok(javaScriptFiles.length > 0, "missing emitted JavaScript");
  const javaScript = readAll(javaScriptFiles);

  // `appState.ts` reads a bare `devicePixelRatio` at module scope, which is a
  // ReferenceError the moment an entry like `data/restore` is imported outside
  // a browser. The `define` in `vite.config.mts` rewrites it to a property
  // read; a build path that skips that define would silently reintroduce the
  // crash, so gate on the emitted bundle rather than on the config.
  assert.doesNotMatch(javaScript, /(?<![.\w$])devicePixelRatio\b/);
});

test("every emitted runtime dependency is declared", () => {
  const javaScriptFiles = walkFiles(distRoot, ".js");
  assert.ok(javaScriptFiles.length > 0, "missing emitted JavaScript");
  const javaScript = readAll(javaScriptFiles);
  const specifiers = [
    // `from "x"`, `import("x")` and the bare side-effect `import "x"`.
    ...javaScript.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"'./][^"']*)["']/g,
    ),
  ]
    .map((match) => match[1])
    .filter((specifier) => /^(?:@[\w.-]+\/|[\w])/.test(specifier));
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);

  const missing = [
    ...new Set(
      specifiers
        .map(packageNameFromSpecifier)
        .filter((packageName) => !declared.has(packageName)),
    ),
  ].sort();
  assert.deepEqual(missing, [], `undeclared emitted imports: ${missing}`);

  assert.equal(declared.has("react"), false);
  assert.equal(declared.has("react-dom"), false);
});

test("deep runtime imports resolve under Node's ESM rules", () => {
  // A bundler happily resolves `roughjs/bin/rough` by trying extensions, so a
  // missing `.js` is invisible until a consumer loads the package as real ESM
  // (Node, SSR, or any strict resolver). Node only permits an extensionless
  // deep specifier when the dependency publishes an `exports` map; otherwise
  // the specifier is a literal path and must name the file exactly.
  const javaScript = readAll(walkFiles(distRoot, ".js"));
  const specifiers = [
    ...new Set(
      [
        ...javaScript.matchAll(
          /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"'./][^"']*)["']/g,
        ),
      ]
        .map((match) => match[1])
        .filter(
          (specifier) => specifier !== packageNameFromSpecifier(specifier),
        ),
    ),
  ].sort();

  const unresolvable = specifiers.filter((specifier) => {
    const packageName = packageNameFromSpecifier(specifier);
    const dependencyRoot = resolveDependency(packageName);
    if (!dependencyRoot) {
      return false;
    }

    const dependencyManifest = JSON.parse(
      readFileSync(join(dependencyRoot, "package.json"), "utf8"),
    );
    if (dependencyManifest.exports) {
      return false;
    }

    const target = join(
      dependencyRoot,
      specifier.slice(packageName.length + 1),
    );
    return !existsSync(target) || statSync(target).isDirectory();
  });

  assert.deepEqual(
    unresolvable,
    [],
    `deep imports Node cannot resolve: ${unresolvable}`,
  );
});

test("declarations carry Angular metadata", () => {
  // `tsc` emits a bare `export declare class`, which a consumer's ngtsc reads
  // as a plain class and rejects from a component's `imports` with NG2012 —
  // with no workaround on the consumer's side. Only the Angular compiler emits
  // the `ɵcmp`/`ɵfac` declarations that mark the class as a standalone
  // component, so the declaration build must run `ngc`, not `tsc`.
  const editorDeclaration = readFileSync(
    join(distRoot, "types/editor.component.d.ts"),
    "utf8",
  );

  assert.match(editorDeclaration, /ɵɵComponentDeclaration</);
  assert.match(editorDeclaration, /ɵɵFactoryDeclaration</);
  // The selector is part of that metadata; without it the component resolves
  // but never matches `<caliburn-editor />` in a consumer's template.
  assert.match(editorDeclaration, /"caliburn-editor"/);
});

test("runtime bundle is compiled in partial mode", () => {
  // Full compilation inlines calls into `@angular/core`'s private instruction
  // API, which is version-specific: the package would work only against the
  // exact Angular it was built with. Partial declarations are linked by the
  // consumer's own compiler, so one build serves every supported major.
  const javaScript = readAll(walkFiles(distRoot, ".js"));

  assert.match(javaScript, /ɵɵngDeclareComponent/);
  assert.doesNotMatch(javaScript, /ɵɵdefineComponent/);
});

test("jotai is consumed through its React-free entry point", () => {
  // `jotai-scope` depends on React outright and its `createIsolation()` runs
  // at module scope, so it cannot tree-shake. `jotai/vanilla` has the same
  // `atom` and `createStore` without pulling React into the tree.
  const javaScript = readAll(walkFiles(distRoot, ".js"));
  const jotaiSpecifiers = [
    ...new Set(
      [...javaScript.matchAll(/["'](jotai[^"']*)["']/g)].map(
        (match) => match[1],
      ),
    ),
  ].sort();

  assert.deepEqual(jotaiSpecifiers, ["jotai/vanilla"]);
  assert.equal("jotai-scope" in (manifest.dependencies ?? {}), false);
});

test("declarations reference only what the package ships", () => {
  // The published declarations are copied from upstream's React sources, so
  // left unfiltered they name React, stylesheet side-effect imports, and
  // packages this manifest does not declare. None of it is suppressible by a
  // consumer type-checking with `skipLibCheck: false`.
  const declarationFiles = walkFiles(join(distRoot, "types"), ".ts");
  const declarations = readAll(declarationFiles);
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);

  const undeclared = [
    ...new Set(
      [
        ...declarations.matchAll(
          /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"'./][^"']*)["']/g,
        ),
      ]
        .map((match) => packageNameFromSpecifier(match[1]))
        .filter((packageName) => !declared.has(packageName)),
    ),
  ].sort();
  assert.deepEqual(
    undeclared,
    [],
    `declarations import undeclared packages: ${undeclared}`,
  );

  // Stylesheets carry no types; upstream imports them for a build-time side
  // effect that has no meaning in a declaration file.
  assert.doesNotMatch(declarations, /^import\s+["']\.[^"']*\.s?css["']/m);
  assert.doesNotMatch(declarations, /["']react(?:\/[^"']*)?["']/);
  assert.doesNotMatch(declarations, /["']jotai-scope["']/);
});

test("declarations are portable outside the monorepo", () => {
  const declarationFiles = walkFiles(join(distRoot, "types"), ".ts");
  assert.ok(declarationFiles.length > 0, "missing emitted declarations");
  const declarations = readAll(declarationFiles);

  assert.doesNotMatch(
    declarations,
    /(["'])@excalidraw\/excalidraw(?:\/[^"']*)?\1/,
  );
  assert.doesNotMatch(declarations, /\/Users\/amedviediev\/Projects\/caliburn/);

  for (const file of declarationFiles) {
    assert.equal(
      file.endsWith(".d.ts"),
      true,
      `unexpected declaration artifact ${relative(distRoot, file)}`,
    );
  }
});
