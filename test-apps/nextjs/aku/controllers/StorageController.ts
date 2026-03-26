import type { Context } from "hono";
import { app } from "../app";

export async function StorageIndexController(c: Context): Promise<Response> {
	try {
		const uploads = app.storage.directory("uploads");
		const files = await uploads.listFiles();
		const fileData = files.map((f) => ({
			name: f.path.split("/").pop(),
			url: `/storage${f.path}`,
		}));
		return c.json({ files: fileData });
	} catch (error) {
		console.error("Storage list error:", error);
		return c.json({ error: String(error) }, 500);
	}
}

export async function StorageStoreController(c: Context): Promise<Response> {
	try {
		const formData = await c.req.raw.formData();
		const file = formData.get("file");

		if (!file || !(file instanceof File)) {
			return c.json({ error: "No file provided" }, 400);
		}

		const storageFile = app.storage.directory("uploads").file(file.name);
		await storageFile.put(file);

		const info = await storageFile.info();
		if (!info) {
			return c.json({ error: "Failed to save file" }, 500);
		}

		return c.json({
			success: true,
			id: file.name,
			size: info.size,
			mimeType: info.mimeType,
		});
	} catch (error) {
		console.error("Storage upload error:", error);
		return c.json({ error: String(error) }, 500);
	}
}

export async function StorageShowController(c: Context): Promise<Response> {
	try {
		const resourceId = c.req.param("resourceId");

		if (!resourceId) {
			return c.notFound();
		}

		const storageFile = app.storage.directory("uploads").file(resourceId);
		const fileExists = await storageFile.exists();

		if (!fileExists) {
			return c.notFound();
		}

		const result = await storageFile.get();
		return result.response;
	} catch (error) {
		console.error("Storage download error:", error);
		return c.json({ error: String(error) }, 500);
	}
}

export async function StorageDestroyController(c: Context): Promise<Response> {
	const resourceId = c.req.param("resourceId");

	if (!resourceId) {
		return c.notFound();
	}

	await app.storage.directory("uploads").file(resourceId).delete();

	return c.json({ success: true });
}
