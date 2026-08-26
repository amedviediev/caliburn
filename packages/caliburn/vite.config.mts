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
]);
// Excalidraw's core packages are consumed from this checkout's sources rather
// than npm, where they exist only as SHA-suffixed prereleases. Bundling them
// keeps the published package installable.
const bundledWorkspacePackages =
  /^@excalidraw\/(excalidraw|common|element|math|utils|laser-pointer|fractional-indexing)(\/|$)/;

const upstreamLibraryModule = path.resolve(
  projectDir,
  "../excalidraw/data/library.ts",
);

const frameworkNeutralOverridePlugin: import("vite").Plugin = {
  name: "caliburn-framework-neutral-overrides",
  enforce: "pre",
  resolveId(source: string, importer?: string) {
    if (!importer || !source.startsWith(".")) {
      return null;
    }

    const importerPath = importer.split("?", 1)[0];
    const resolved = path.resolve(path.dirname(importerPath), source);
    return frameworkNeutralOverrides.get(resolved) ?? null;
  },
  transform(code: string, id: string) {
    if (id.split("?", 1)[0] !== upstreamLibraryModule) {
      return null;
    }

    // Caliburn consumes the framework-neutral Library class and helpers, not
    // this module's exported React hook. Removing the hook-only import lets
    // Rollup discard `useHandleLibrary` without preserving React's side effect.
    return code.replace(
      'import { useEffect, useRef } from "react";',
      "const useEffect = () => {}; const useRef = (value) => ({ current: value });",
    );
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
  build: {
    assetsInlineLimit: 0,
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(projectDir, "src/package-entry.ts"),
      preserveEntrySignatures: "strict",
      external: (id) => {
        if (bundledWorkspacePackages.test(id)) {
          return false;
        }
        return !id.startsWith(".") && !path.isAbsolute(id);
      },
      output: {
        format: "es",
        entryFileNames: "index.js",
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
