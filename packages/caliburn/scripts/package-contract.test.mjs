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

  assert.doesNotMatch(
    javaScript,
    /(?:from\s*|import\s*\()["']react(?:\/[^"']*)?["']/,
  );
  assert.doesNotMatch(
    javaScript,
    /["']@excalidraw\/excalidraw(?:\/[^"']*)?["']/,
  );
});

test("every emitted runtime dependency is declared", () => {
  const javaScriptFiles = walkFiles(distRoot, ".js");
  assert.ok(javaScriptFiles.length > 0, "missing emitted JavaScript");
  const javaScript = readAll(javaScriptFiles);
  const specifiers = [
    ...javaScript.matchAll(/(?:from\s*|import\s*\()["']([^"'./][^"']*)["']/g),
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
