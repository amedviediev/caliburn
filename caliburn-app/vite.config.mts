import path from "node:path";
import { fileURLToPath } from "node:url";

import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vite";

import { workspaceAliases } from "../vitest.alias";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(projectDir, "..");

// the app's env contract is upstream's, and the files live at the repo root
// (`.env.development` / `.env.production`), as they do upstream
export default defineConfig({
  root: projectDir,
  envDir: rootDir,
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
  server: {
    port: 3001,
  },
});
