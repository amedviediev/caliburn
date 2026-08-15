import { defineConfig } from "vite";

import { workspaceAliases } from "../../../vitest.alias";

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
});
