import { defineConfig } from "tsdown";
import * as fs from "node:fs";
import module from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";
import { discoverEntryPointsFromFilesystem } from "./src/test-utils/source/discoverEntryPoints.ts";

const bundledDeps = ["devalue", "@bradenmacdonald/s3-lite-client", "csstype", "@inquirer/prompts", "wrap-ansi"];

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const allBundledDeps = resolveTransitiveDeps(bundledDeps);
const nodeBuiltins = new Set(module.builtinModules);

const __dirname = dirname(fileURLToPath(import.meta.url));
const entryPoints = discoverEntryPointsFromFilesystem(join(__dirname, "src"));

export default defineConfig({
  entry: entryPoints,
  format: ["esm"],
  outDir: "dist",
  dts: {
    build: true,
    sourcemap: true,
  },
  clean: false,
  plugins: [
    visualizer({
      filename: "bundle-treemap.html",
      gzipSize: true,
    }),
  ],
  external: (dep) => {
    // local source files are bundled
    if (dep.startsWith(".") || dep.startsWith("/") || dep.startsWith("src/")) return false;
    if (allBundledDeps.has(dep)) return false;
    if (dep.startsWith("node:") || dep.startsWith("bun:") || nodeBuiltins.has(dep)) return true;
    if (isPeerDependency(dep)) return true;
    throw new Error(`External dependency not allowed: ${dep}`);
  },
});

const isPeerDependency = (dep: string) => {
  const parts = dep.split("/");
  const packageName = dep.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  return packageName in packageJson.peerDependencies;
};

// Parse bun.lock (JSONC with trailing commas) to resolve transitive deps of bundled packages
function resolveTransitiveDeps(directDeps: string[]): Set<string> {
  const lockfileText = fs.readFileSync("../../bun.lock", "utf-8").replace(/,(\s*[}\]])/g, "$1");
  const lockfilePackages: Record<string, [string, string, { dependencies?: Record<string, string> }]> =
    JSON.parse(lockfileText).packages;

  const result = new Set(directDeps);
  console.log("Bundled dependencies (with transitive deps):");
  for (const dep of directDeps) {
    console.log(`  ${dep}`);
    addTransitiveDeps(dep, 2);
  }
  return result;

  function addTransitiveDeps(pkg: string, depth: number): void {
    const entry = lockfilePackages[pkg];
    if (!entry) return;
    const deps = entry[2]?.dependencies;
    if (!deps) return;
    const indent = "  ".repeat(depth);
    for (const dep of Object.keys(deps)) {
      if (!result.has(dep)) {
        result.add(dep);
        console.log(`${indent}${dep}`);
        addTransitiveDeps(dep, depth + 1);
      }
    }
  }
}
