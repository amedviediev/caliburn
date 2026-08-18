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
const typesRoot = join(packageRoot, "dist/types");
const upstreamRoot = resolve(
  packageRoot,
  "../excalidraw/dist/types/excalidraw",
);
const vendorRoot = join(typesRoot, "vendor/excalidraw");

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

rmSync(vendorRoot, { force: true, recursive: true });
copyTree(upstreamRoot, vendorRoot);

for (const file of walkFiles(typesRoot).filter((path) =>
  path.endsWith(".d.ts"),
)) {
  const source = readFileSync(file, "utf8");
  const rewritten = source.replace(
    /(["'])@excalidraw\/excalidraw(?:\/([^"']+))?\1/g,
    (_match, quote, suffix) => {
      const target = join(vendorRoot, suffix || "index");
      let specifier = relative(dirname(file), target).split(sep).join("/");
      if (!specifier.startsWith(".")) {
        specifier = `./${specifier}`;
      }
      return `${quote}${specifier}${quote}`;
    },
  );
  writeFileSync(file, rewritten);
}

const declarations = walkFiles(typesRoot)
  .filter((path) => path.endsWith(".d.ts"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

if (/(["'])@excalidraw\/excalidraw(?:\/[^"']*)?\1/.test(declarations)) {
  throw new Error("Private @excalidraw/excalidraw type specifiers remain");
}

if (declarations.includes(resolve(packageRoot, "../.."))) {
  throw new Error("Absolute checkout paths remain in emitted declarations");
}
