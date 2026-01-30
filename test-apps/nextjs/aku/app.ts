import { createApplication } from "@akujs/aku";
import { filesystemStorage } from "@akujs/aku/storage";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import routes from "./routes/web";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store files in public directory so they can be served by Next.js
const storageRoot = join(__dirname, "..", "public", "storage");
const uploadsPath = join(storageRoot, "uploads");
const seedImagesPath = join(__dirname, "img");

// Seed uploads folder with default images if empty
function seedUploadsIfEmpty(): void {
	// Ensure uploads directory exists
	if (!existsSync(uploadsPath)) {
		mkdirSync(uploadsPath, { recursive: true });
	}

	// Check if uploads is empty
	const existingFiles = readdirSync(uploadsPath);
	if (existingFiles.length === 0) {
		// Copy seed images
		const seedImages = readdirSync(seedImagesPath);
		for (const image of seedImages) {
			const src = join(seedImagesPath, image);
			const dest = join(uploadsPath, image);
			copyFileSync(src, dest);
		}
		console.log(`Seeded ${seedImages.length} images into uploads folder`);
	}
}

seedUploadsIfEmpty();

export const app = createApplication({
	routes,
	development: true,
	appUrl: {},
	disks: {
		local: filesystemStorage({
			rootPath: storageRoot,
			publicUrlPrefix: "/storage",
			// makePublicUrlWith: (url) => `${url}?v=123`,
		}),
	},
});
