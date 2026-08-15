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
});
