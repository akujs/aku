import { createApplication } from "@akujs/aku";
import { filesystemStorage } from "@akujs/aku/storage";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { Hono } from "hono";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
	DeleteCookieController,
	EchoParamController,
	GetCookiesController,
	SetCookieController,
} from "./controllers/CookieApiController";
import { CookiePageController } from "./controllers/CookiePageController";
import {
	StorageDestroyController,
	StorageIndexController,
	StorageShowController,
	StorageStoreController,
} from "./controllers/StorageController";
import {
	StorageDeleteController,
	StoragePageController,
	StorageUploadController,
} from "./controllers/StoragePageController";

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

const hono = new Hono();

// Page routes
hono.get("/aku", (c) => c.redirect("/aku/cookies"));
hono.get("/aku/cookies", CookiePageController);
hono.get("/aku/storage", StoragePageController);
hono.post("/aku/storage/upload", StorageUploadController);
hono.post("/aku/storage/delete/:filename", StorageDeleteController);

// API routes for cookie testing
hono.get("/aku/api/cookies", GetCookiesController);
hono.post("/aku/api/cookies", SetCookieController);
hono.delete("/aku/api/cookies/:name", DeleteCookieController);

// API routes for param testing
hono.get("/aku/api/param/:param/test", EchoParamController);

// API routes for storage testing
hono.get("/aku/api/storage", StorageIndexController);
hono.post("/aku/api/storage", StorageStoreController);
hono.get("/aku/api/storage/:resourceId", StorageShowController);
hono.delete("/aku/api/storage/:resourceId", StorageDestroyController);

// Legacy route kept for compatibility
hono.get("/people/:personId", CookiePageController);

export const app = createApplication({
	handler: hono.fetch,
	development: true,
	appUrl: {},
	disks: {
		local: filesystemStorage({
			rootPath: storageRoot,
			publicUrlPrefix: "https://localhost/storage",
			makePublicUrlWith: (url) => `${url}?v=123`,
		}),
	},
});
