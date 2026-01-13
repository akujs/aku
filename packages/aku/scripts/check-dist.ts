import * as path from "node:path";

import { $ } from "bun";

const distFolder = path.join(__dirname, "..", "dist");
const packageJson = await import("../package.json");

const importedPackages = new Set<string>();

let hasError = false;

for await (let line of $`grep -REh "from ['\"]" "${distFolder}"`.lines()) {
	line = line.trim();
	if (!line) continue;

	// Filter out imports that are actually documentation examples inside comment blocks
	if (/(\/\/|\*)/.test(line)) continue;

	const match = line.match(/from ['"]([^'"]+)['"]/);

	if (!match) {
		console.error(`💥 import line has no "from" clause: "${line}"`);
		hasError = true;
		continue;
	}

	const importPath = match[1];

	// Local imports
	if (importPath.startsWith(".")) continue;

	if (importPath.startsWith("node:") || importPath.startsWith("bun:")) continue;

	const packageName = importPath.startsWith("@")
		? importPath
				.split("/")
				.slice(0, 2)
				.join("/") // @scope/pkg
		: importPath.split("/")[0]; // pkg

	importedPackages.add(packageName);
}

const peerDeps = new Set(Object.keys(packageJson.peerDependencies || {}));

const inDistNotInPeer = [...importedPackages].filter((pkg) => !peerDeps.has(pkg));
const inPeerNotInDist = [...peerDeps].filter((pkg) => !importedPackages.has(pkg));

if (inDistNotInPeer.length > 0) {
	for (const pkg of inDistNotInPeer) {
		console.error(`💥 Build output imports package ${pkg} but it's not in peerDependencies`);
	}
	hasError = true;
}

if (inPeerNotInDist.length > 0) {
	for (const pkg of inPeerNotInDist) {
		console.error(`💥 Package ${pkg} is in peerDependencies but not imported in build output`);
	}
	hasError = true;
}

if (hasError) {
	process.exit(1);
}

console.log(`✓ build output checked`);
