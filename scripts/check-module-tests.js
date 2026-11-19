// Fails when a module's entry point has no test. Every root file of a module
// in app/modules/<name>/ is an entry point (see app/modules/README.md), and
// some file in that module's tests/ folder must import it.
// Usage: node scripts/check-module-tests.js

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MODULES = "app/modules";
const SOURCE = /\.tsx?$/;
const TEST = /\.test\.tsx?$/;

const filesIn = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? filesIn(path) : [path];
      })
    : [];

// The entry points a test file imports, as names without extension:
// "../index.server" -> "index.server", "~/modules/<name>" -> "index".
const importedEntryPoints = (name, source) => {
  const specifiers = [
    ...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g),
  ].map((match) => match[1]);
  return specifiers.flatMap((specifier) => {
    const relative = /^\.\.\/([^/]+)$/.exec(specifier);
    if (relative) return [relative[1].replace(SOURCE, "")];
    const aliased = new RegExp(`^~/modules/${name}(?:/([^/]+))?$`).exec(
      specifier
    );
    if (aliased) return [(aliased[1] ?? "index").replace(SOURCE, "")];
    return [];
  });
};

const untested = readdirSync(MODULES)
  .filter((name) => statSync(join(MODULES, name)).isDirectory())
  .flatMap((name) => {
    const root = join(MODULES, name);
    const entryPoints = readdirSync(root).filter(
      (file) => SOURCE.test(file) && !TEST.test(file)
    );
    const imported = new Set(
      filesIn(join(root, "tests"))
        .filter((file) => TEST.test(file))
        .flatMap((file) =>
          importedEntryPoints(name, readFileSync(file, "utf8"))
        )
    );
    return entryPoints
      .filter((file) => !imported.has(file.replace(SOURCE, "")))
      .map((file) => join(root, file));
  });

if (untested.length > 0) {
  console.error("These module entry points have no test that imports them:\n");
  for (const file of untested) console.error(`  ${file}`);
  console.error(`
A module ships with its tests. Add a test in the module's tests/ folder that
imports each entry point above and exercises what it exports. This includes
code you moved into a module unchanged: moving it is when it gets its tests.
Arrange data through the module's own functions (CODING_STANDARDS.md,
"Arrange tests through the module under test"). See app/modules/README.md.`);
  process.exit(1);
}
