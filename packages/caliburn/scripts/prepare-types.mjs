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
const upstreamRoot = resolve(packageRoot, "../excalidraw/dist/types");
const vendorRoot = join(typesRoot, "vendor");

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

const declarations = walkFiles(typesRoot)
  .filter((path) => path.endsWith(".d.ts"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

const remaining = declarations.match(vendoredSpecifier);
if (remaining) {
  throw new Error(
    `Unresolved vendored type specifiers remain: ${[
      ...new Set(remaining),
    ].join(", ")}`,
  );
}

if (declarations.includes(resolve(packageRoot, "../.."))) {
  throw new Error("Absolute checkout paths remain in emitted declarations");
}
