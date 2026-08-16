import path from "node:path";
import { fileURLToPath } from "node:url";

import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vite";

import { workspaceAliases } from "../../vitest.alias";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectDir,
  plugins: [
    angular({
      jit: false,
      tsconfig: path.join(projectDir, "tsconfig.json"),
    }),
  ],
  resolve: {
    alias: workspaceAliases,
  },
  // the angular plugin turns vite's esbuild transform off for the whole
  // project; the few upstream .tsx modules still in the import graph
  // (predicates, tool tables) need it
  esbuild: {
    include: [/\.tsx$/],
  },
});
