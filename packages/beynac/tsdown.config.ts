import { defineConfig } from "tsdown";
import { ENTRY_POINTS } from "./src/test-utils/entryPoints.ts";
import * as fs from "node:fs";

const bundledDeps = ["devalue", "@bradenmacdonald/s3-lite-client", "csstype"];

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

export default defineConfig({
  entry: ENTRY_POINTS,
  format: ["esm"],
  outDir: "dist",
  dts: {
    resolve: true,
    build: true,
  },
  clean: true,
  external: (dep) => {
    // local source files are bundled
    if (dep.startsWith(".") || dep.startsWith("/") || dep.startsWith("src/")) return false;
    if (bundledDeps.includes(dep)) return false;
    if (dep.startsWith("node:") || dep.startsWith("bun:")) return true;
    if (isPeerDependency(dep)) return true;
    throw new Error(`External dependency not allowed: ${dep}`);
  },
});

const isPeerDependency = (dep: string) => {
  const parts = dep.split("/");
  const packageName = dep.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  return packageName in packageJson.peerDependencies;
};