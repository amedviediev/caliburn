import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export const workspaceAliases = [
  {
    find: /^@excalidraw\/common$/,
    replacement: path.resolve(rootDir, "./packages/common/src/index.ts"),
  },
  {
    find: /^@excalidraw\/common\/(.*?)/,
    replacement: path.resolve(rootDir, "./packages/common/src/$1"),
  },
  {
    find: /^@excalidraw\/element$/,
    replacement: path.resolve(rootDir, "./packages/element/src/index.ts"),
  },
  {
    find: /^@excalidraw\/element\/(.*?)/,
    replacement: path.resolve(rootDir, "./packages/element/src/$1"),
  },
  {
    find: /^@excalidraw\/excalidraw$/,
    replacement: path.resolve(rootDir, "./packages/excalidraw/index.tsx"),
  },
  {
    find: /^@excalidraw\/excalidraw\/(.*?)/,
    replacement: path.resolve(rootDir, "./packages/excalidraw/$1"),
  },
  {
    find: /^@excalidraw\/math$/,
    replacement: path.resolve(rootDir, "./packages/math/src/index.ts"),
  },
  {
    find: /^@excalidraw\/math\/(.*?)/,
    replacement: path.resolve(rootDir, "./packages/math/src/$1"),
  },
  {
    find: /^@excalidraw\/utils$/,
    replacement: path.resolve(rootDir, "./packages/utils/src/index.ts"),
  },
  {
    find: /^@excalidraw\/utils\/(.*?)/,
    replacement: path.resolve(rootDir, "./packages/utils/src/$1"),
  },
  {
    find: /^@excalidraw\/fractional-indexing$/,
    replacement: path.resolve(
      rootDir,
      "./packages/fractional-indexing/src/index.ts",
    ),
  },
  {
    find: /^@excalidraw\/fractional-indexing\/(.*?)/,
    replacement: path.resolve(rootDir, "./packages/fractional-indexing/src/$1"),
  },
  {
    find: /^@excalidraw\/laser-pointer$/,
    replacement: path.resolve(rootDir, "./packages/laser-pointer/src/index.ts"),
  },
  {
    find: /^@excalidraw\/laser-pointer\/(.*?)/,
    replacement: path.resolve(rootDir, "./packages/laser-pointer/src/$1"),
  },
];
