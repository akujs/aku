import { abort, type ControllerContext, ResourceController } from "beynac/http";
import { app } from "../app";

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export class StorageController extends ResourceController {
	async index() {
		try {
			const files = await app.storage.directory("/uploads").listFiles();
			const fileData = files.map((f) => ({
				name: f.path.split("/").pop(),
				url: `/storage${f.path}`,
			}));
			return jsonResponse({ files: fileData });
		} catch (error) {
			console.error("Storage list error:", error);
			return jsonResponse({ error: String(error) }, 500);
		}
	}

	async store({ request }: ControllerContext) {
		try {
			const formData = await request.formData();
			const file = formData.get("file");

			if (!file || !(file instanceof File)) {
				return jsonResponse({ error: "No file provided" }, 400);
			}

			const path = `/uploads/${file.name}`;
			await app.storage.file(path).put(file);

			const info = await app.storage.file(path).info();
			if (!info) {
				return jsonResponse({ error: "Failed to save file" }, 500);
			}

			return jsonResponse({
				success: true,
				id: file.name,
				size: info.size,
				mimeType: info.mimeType,
			});
		} catch (error) {
			console.error("Storage upload error:", error);
			return jsonResponse({ error: String(error) }, 500);
		}
	}

	async show({ params }: ControllerContext) {
		try {
			const { resourceId } = params;

			if (!resourceId) {
				abort.notFound();
			}

			const path = `/uploads/${resourceId}`;
			const fileExists = await app.storage.file(path).exists();

			if (!fileExists) {
				abort.notFound();
			}

			const result = await app.storage.file(path).get();
			return result.response;
		} catch (error) {
			console.error("Storage download error:", error);
			return jsonResponse({ error: String(error) }, 500);
		}
	}

	async destroy({ params }: ControllerContext) {
		const { resourceId } = params;

		if (!resourceId) {
			abort.notFound();
		}

		const path = `/uploads/${resourceId}`;
		await app.storage.file(path).delete();

		return jsonResponse({ success: true });
	}
}
