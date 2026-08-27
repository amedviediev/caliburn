import path from "node:path";
import { fileURLToPath } from "node:url";

import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vite";

import { workspaceAliases } from "../../vitest.alias";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

const frameworkNeutralOverrides = new Map([
  [
    path.resolve(projectDir, "../excalidraw/hooks/useLibraryItemSvg"),
    path.resolve(projectDir, "src/vendor/library-item-svg-cache.ts"),
  ],
  [
    path.resolve(projectDir, "../excalidraw/reactUtils"),
    path.resolve(projectDir, "src/vendor/react-utils.ts"),
  ],
  [
    path.resolve(projectDir, "../excalidraw/components/icons"),
    path.resolve(projectDir, "src/vendor/icon-svg-paths.ts"),
  ],
  [
    path.resolve(projectDir, "../excalidraw/editor-jotai"),
    path.resolve(projectDir, "src/vendor/editor-jotai.ts"),
  ],
]);

// Neither `roughjs` nor `points-on-curve` publishes an `exports` map, so Node
// reads a deep specifier as a literal path and needs the file extension.
// Bundlers guess the extension; Node ESM and SSR do not, so rewrite the
// specifier on the way out rather than leaving consumers to discover it.
const extensionlessDeepImports = [
  "points-on-curve/lib/curve-to-bezier",
  "roughjs/bin/generator",
  "roughjs/bin/math",
  "roughjs/bin/rough",
];
// Excalidraw's core packages are consumed from this checkout's sources rather
// than npm, where they exist only as SHA-suffixed prereleases. Bundling them
// keeps the published package installable.
const bundledWorkspacePackages =
  /^@excalidraw\/(excalidraw|common|element|math|utils|laser-pointer|fractional-indexing)(\/|$)/;

// Vendored Excalidraw surfaces a host app has to reach directly (collaboration,
// persistence, geometry). Each is its own Rollup entry so the exports map can
// address it without widening the root barrel; Rollup hoists the code they
// share with `index` into common chunks, so the modules stay single-instance.
const subpathEntries = [
  "common/index",
  "data/blob",
  "data/encode",
  "data/encryption",
  "data/json",
  "data/reconcile",
  "data/restore",
  "element/index",
  "element/types",
  "math/index",
  "types",
  "utils/index",
];

// `data/library.ts` imports React hooks for `useHandleLibrary`, a hook
// Caliburn never calls; its framework-neutral `Library` class is the reason
// the module is in the graph at all. Rewriting the import in a `transform`
// hook does not work — the Angular plugin recompiles `.ts` from its own
// TypeScript program, reading the original file from disk, so the rewrite is
// discarded. Resolving `react` to an inert stub is what actually keeps it out
// of `dist`, and out of the dependency list a consumer has to satisfy.
const reactStubModuleId = "\0caliburn:react-stub";

const frameworkNeutralOverridePlugin: import("vite").Plugin = {
  name: "caliburn-framework-neutral-overrides",
  enforce: "pre",
  resolveId(source: string, importer?: string) {
    if (source === "react") {
      return reactStubModuleId;
    }

    // The vendored tree imports these relatively, but Caliburn's own sources
    // reach them through the `@excalidraw/excalidraw/*` alias — and Vite's
    // alias plugin has already rewritten those to an absolute path by the time
    // this runs. Both forms have to hit the override, or the upstream module
    // stays in the graph alongside its replacement.
    const resolved = path.isAbsolute(source)
      ? source
      : importer && source.startsWith(".")
      ? path.resolve(path.dirname(importer.split("?", 1)[0]), source)
      : null;

    return resolved ? frameworkNeutralOverrides.get(resolved) ?? null : null;
  },
  load(id: string) {
    if (id !== reactStubModuleId) {
      return null;
    }

    // Only the two hooks `useHandleLibrary` closes over are stubbed. Anything
    // else reaching for React means a genuinely React-dependent module entered
    // the bundle, which should fail loudly rather than no-op.
    return `export const useEffect = () => {};
export const useRef = (value) => ({ current: value });
export default new Proxy({}, {
  get: (_target, property) => {
    throw new Error(
      \`React.\${String(property)} is unavailable in Caliburn's bundle.\`,
    );
  },
});
`;
  },
};

export default defineConfig(({ command }) => ({
  plugins: [
    ...(command === "build" ? [frameworkNeutralOverridePlugin] : []),
    angular({
      jit: false,
      tsconfig: path.join(
        projectDir,
        command === "build" ? "tsconfig.json" : "tsconfig.spec.json",
      ),
    }),
  ],
  resolve: {
    alias: workspaceAliases,
  },
  // The Angular plugin turns Vite's esbuild transform off for the whole
  // project; JSX-compat test files still need it.
  esbuild: {
    include: [/\.tsx$/],
  },
  // `appState.ts` reads the bare `devicePixelRatio` global at module scope, so
  // importing any entry that pulls it in — `data/restore` among them — throws a
  // ReferenceError outside a browser. Reading it off `globalThis` is the same
  // value in a browser and `undefined` under SSR, where the `EXPORT_SCALES`
  // membership test then falls through to the default scale.
  define: {
    devicePixelRatio: "globalThis.devicePixelRatio",
  },
  build: {
    assetsInlineLimit: 0,
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        [
          ["index", "src/package-entry.ts"],
          ...subpathEntries.map((entry) => [entry, `src/${entry}.ts`]),
        ].map(([name, source]) => [name, path.join(projectDir, source)]),
      ),
      preserveEntrySignatures: "strict",
      external: (id) => {
        // Rollup consults `external` before `resolveId`, so React has to be
        // declared internal for the stub above to get a chance to replace it.
        if (bundledWorkspacePackages.test(id) || id === "react") {
          return false;
        }
        return !id.startsWith(".") && !path.isAbsolute(id);
      },
      output: {
        format: "es",
        paths: Object.fromEntries(
          extensionlessDeepImports.map((specifier) => [
            specifier,
            `${specifier}.js`,
          ]),
        ),
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith(".css"))
            ? "index.css"
            : asset.names.some((name) => name.endsWith(".woff2"))
            ? "fonts/[name][extname]"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
  //@ts-ignore
  test: {
    name: "caliburn",
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
}));
