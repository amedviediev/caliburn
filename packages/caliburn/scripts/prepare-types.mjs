import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
);
const typesRoot = join(packageRoot, "dist/types");
const upstreamRoot = resolve(packageRoot, "../excalidraw/dist/types");
// Kept distinct from `dist/types/vendor`, where `src/vendor/*` emits its own
// declarations: this directory is wiped and refilled from upstream on every
// build, which would otherwise delete the framework-neutral replacements.
const vendorRoot = join(typesRoot, "upstream");
const overrideRoot = join(typesRoot, "vendor");

// The runtime bundle inlines these packages instead of resolving them from
// npm, so their declarations have to travel with the published package too.
const vendoredPackages = new Map([
  ["excalidraw", "excalidraw"],
  ["common", "common/src"],
  ["element", "element/src"],
  ["math", "math/src"],
  ["utils", "utils/src"],
  ["laser-pointer", "laser-pointer/src"],
  ["fractional-indexing", "fractional-indexing/src"],
]);

const vendoredSpecifier = new RegExp(
  `(["'])@excalidraw/(${[...vendoredPackages.keys()].join(
    "|",
  )})(?:/([^"']+))?\\1`,
  "g",
);

const walkFiles = (root) =>
  readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });

const copyTree = (source, target) => {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source)) {
    const sourcePath = join(source, entry);
    const targetPath = join(target, entry);
    if (statSync(sourcePath).isDirectory()) {
      copyTree(sourcePath, targetPath);
    } else {
      copyFileSync(sourcePath, targetPath);
    }
  }
};

if (!existsSync(upstreamRoot)) {
  throw new Error(
    `Missing Excalidraw declarations at ${upstreamRoot}. Run yarn --cwd packages/excalidraw gen:types first.`,
  );
}

for (const [packageName, packageRootPath] of vendoredPackages) {
  const source = join(upstreamRoot, packageRootPath);
  if (!existsSync(source)) {
    throw new Error(
      `Missing declarations for @excalidraw/${packageName} at ${source}`,
    );
  }
}

rmSync(vendorRoot, { force: true, recursive: true });
copyTree(upstreamRoot, vendorRoot);

for (const file of walkFiles(typesRoot).filter((path) =>
  path.endsWith(".d.ts"),
)) {
  const source = readFileSync(file, "utf8");
  const rewritten = source.replace(
    vendoredSpecifier,
    (_match, quote, packageName, suffix) => {
      const target = join(
        vendorRoot,
        vendoredPackages.get(packageName),
        suffix || "index",
      );
      let specifier = relative(dirname(file), target).split(sep).join("/");
      if (!specifier.startsWith(".")) {
        specifier = `./${specifier}`;
      }
      return `${quote}${specifier}${quote}`;
    },
  );
  writeFileSync(file, rewritten);
}

// Upstream's declaration tree is copied wholesale, but only a fraction of it
// is reachable from what this package actually exports. The rest is React
// component typings that drag `.scss` side-effect imports and packages this
// package does not depend on (`radix-ui`, `tunnel-rat`, `subset-font`,
// `lodash`) into the published surface, where a consumer type-checking with
// `skipLibCheck: false` trips over every one of them.

// `vite.config.mts` swaps these upstream modules for framework-neutral
// replacements at build time, so the published declarations have to describe
// the replacement rather than the module it displaced. Left alone, the types
// promise React hooks the bundle does not contain.
const overriddenDeclarations = new Map([
  ["excalidraw/editor-jotai.d.ts", "editor-jotai"],
]);

for (const [upstream, replacement] of overriddenDeclarations) {
  const target = join(vendorRoot, upstream);
  if (!existsSync(target)) {
    throw new Error(`Missing vendored declaration to override: ${upstream}`);
  }

  const source = join(overrideRoot, `${replacement}.d.ts`);
  if (!existsSync(source)) {
    throw new Error(`Missing replacement declaration: ${replacement}.d.ts`);
  }

  let specifier = relative(dirname(target), join(overrideRoot, replacement))
    .split(sep)
    .join("/");
  if (!specifier.startsWith(".")) {
    specifier = `./${specifier}`;
  }

  writeFileSync(target, `export * from "${specifier}";\n`);
}

const languageData = resolve(packageRoot, "../excalidraw/locales/en.json");
const languageDeclaration = join(vendorRoot, "excalidraw/locales/en.d.ts");

// `TranslationKeys` is derived from this JSON's shape, so it cannot simply be
// dropped. Emitting an equivalent declaration keeps the key union exact
// without requiring `resolveJsonModule` from the consumer.
const languageType = (value) =>
  typeof value === "object" && value !== null
    ? `{ ${Object.keys(value)
        .map((key) => `${JSON.stringify(key)}: ${languageType(value[key])};`)
        .join(" ")} }`
    : "string";

if (existsSync(languageData)) {
  mkdirSync(dirname(languageDeclaration), { recursive: true });
  writeFileSync(
    languageDeclaration,
    `declare const languageData: ${languageType(
      JSON.parse(readFileSync(languageData, "utf8")),
    )};\nexport default languageData;\n`,
  );
} else {
  throw new Error(`Missing language data at ${languageData}`);
}

const rewriteAll = (transform) => {
  for (const file of walkFiles(typesRoot).filter((path) =>
    path.endsWith(".d.ts"),
  )) {
    const source = readFileSync(file, "utf8");
    const rewritten = transform(source, file);
    if (rewritten !== source) {
      writeFileSync(file, rewritten);
    }
  }
};

rewriteAll((source) =>
  source.replace(/(["'])(\.[^"']*\/locales\/en)\.json\1/g, "$1$2$1"),
);

// The bundle resolves `jotai` to its React-free entry, so the declarations
// have to say the same. Left as bare `jotai`, a consumer type-checking with
// `skipLibCheck: false` follows the root types into `jotai/react`, which
// needs React that this package deliberately does not ship.
rewriteAll((source) => source.replace(/(["'])jotai\1/g, '"jotai/vanilla"'));

const resolveRelative = (importer, specifier) => {
  const base = resolve(dirname(importer), specifier);
  for (const candidate of [`${base}.d.ts`, join(base, "index.d.ts"), base]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
};

const entryDeclarations = Object.values(manifest.exports)
  .map((entry) => (typeof entry === "string" ? null : entry.types))
  .filter(Boolean)
  .map((target) => resolve(packageRoot, target));

const reachable = new Set();
const pending = [...entryDeclarations];
while (pending.length) {
  const file = pending.pop();
  if (!file || reachable.has(file) || !existsSync(file)) {
    continue;
  }
  reachable.add(file);

  const source = readFileSync(file, "utf8");
  for (const [, specifier] of source.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']*)["']/g,
  )) {
    const target = resolveRelative(file, specifier);
    if (target) {
      pending.push(target);
    }
  }
}

for (const file of walkFiles(typesRoot).filter((path) =>
  path.endsWith(".d.ts"),
)) {
  if (!reachable.has(file)) {
    rmSync(file, { force: true });
  }
}

const removeEmptyDirectories = (root) => {
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      removeEmptyDirectories(path);
      if (readdirSync(path).length === 0) {
        rmSync(path, { recursive: true, force: true });
      }
    }
  }
};
removeEmptyDirectories(typesRoot);

// Stylesheets carry no types, and upstream imports them for their build-time
// side effect only.
rewriteAll((source) =>
  source.replace(/^import\s+["']\.[^"']*\.(?:s?css)["'];?\n/gm, ""),
);

// React and `jotai-scope` are absent from this package by design, but the
// vendored declarations are emitted from upstream's React sources and still
// name their types. Declaring an ambient `react` module would shadow the real
// one in any consumer that has React of its own, so every reference is
// redirected at a local stand-in instead.
const shimDeclaration = join(vendorRoot, "_shims.d.ts");
writeFileSync(
  shimDeclaration,
  `/**
 * Stand-ins for types the vendored Excalidraw declarations name but this
 * package does not ship or depend on. Nothing here is reachable at runtime:
 * Caliburn's bundle contains no React and no \`jotai-scope\`.
 */
export type ReactNode = unknown;
export type FC<P = Record<string, unknown>> = (props: P) => unknown;
export type MemoExoticComponent<T> = T;
export type ForwardRefRenderFunction<T, P> = (
  props: P,
  ref: { current: T | null },
) => unknown;

export interface Context<T> {
  Provider: unknown;
  Consumer: unknown;
  displayName?: string;
  _contextValue?: T;
}

export declare class Component<P = Record<string, unknown>, S = unknown> {
  props: Readonly<P>;
  state: Readonly<S>;
  setState(state: Partial<S>, callback?: () => void): void;
  forceUpdate(callback?: () => void): void;
  render(): ReactNode;
}

export interface SyntheticEvent<T = Element> {
  currentTarget: T;
  target: EventTarget;
  nativeEvent: Event;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
}

export interface PointerEvent<T = Element> extends SyntheticEvent<T> {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  button: number;
  buttons: number;
}

export interface DragEvent<T = Element> extends SyntheticEvent<T> {
  dataTransfer: DataTransfer;
  clientX: number;
  clientY: number;
}

export declare namespace JSX {
  type Element = unknown;
  interface IntrinsicElements {
    [name: string]: unknown;
  }
}

export declare function createIsolation(): {
  Provider: unknown;
  useAtom: unknown;
  useSetAtom: unknown;
  useAtomValue: unknown;
  useStore: unknown;
};
`,
);

rewriteAll((source, file) => {
  let specifier = relative(
    dirname(file),
    shimDeclaration.replace(/\.d\.ts$/, ""),
  )
    .split(sep)
    .join("/");
  if (!specifier.startsWith(".")) {
    specifier = `./${specifier}`;
  }

  return source
    .replace(
      /^import\s+(?:type\s+)?React(?:,\s*\{[^}]*\})?\s+from\s+["']react["'];?$/gm,
      `import type * as React from "${specifier}";`,
    )
    .replace(
      /^import\s+type\s+\{([^}]*)\}\s+from\s+["']react["'];?$/gm,
      `import type {$1} from "${specifier}";`,
    )
    .replace(/["']react\/jsx-runtime["']/g, `"${specifier}"`)
    .replace(
      /^import\s+\{([^}]*)\}\s+from\s+["']jotai-scope["'];?$/gm,
      `import type {$1} from "${specifier}";`,
    );
});

// Some upstream declarations name `React.*` without importing React at all,
// relying on the global namespace `@types/react` installs. That global does
// not exist for a consumer of this package, so the import has to be added.
rewriteAll((source, file) => {
  if (
    !/\bReact\./.test(source) ||
    source.includes('as React from "') ||
    !/^\s*(?:import|export)\b/m.test(source)
  ) {
    return source;
  }

  let specifier = relative(
    dirname(file),
    shimDeclaration.replace(/\.d\.ts$/, ""),
  )
    .split(sep)
    .join("/");
  if (!specifier.startsWith(".")) {
    specifier = `./${specifier}`;
  }

  return `import type * as React from "${specifier}";\n${source}`;
});

const declarations = walkFiles(typesRoot)
  .filter((path) => path.endsWith(".d.ts"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

const remaining = declarations.match(vendoredSpecifier);
if (remaining) {
  throw new Error(
    `Unresolved vendored type specifiers remain: ${[...new Set(remaining)].join(
      ", ",
    )}`,
  );
}

if (declarations.includes(resolve(packageRoot, "../.."))) {
  throw new Error("Absolute checkout paths remain in emitted declarations");
}
