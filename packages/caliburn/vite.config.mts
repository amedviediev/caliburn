import path from "node:path";
import { fileURLToPath } from "node:url";

import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vite";

import { workspaceAliases } from "../../vitest.alias";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    angular({
      jit: false,
      tsconfig: path.join(projectDir, "tsconfig.spec.json"),
    }),
  ],
  resolve: {
    alias: workspaceAliases,
  },
  //@ts-ignore
  test: {
    name: "caliburn",
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
