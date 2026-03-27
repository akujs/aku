/** @jsxImportSource hono/jsx **/
import type { Context } from "hono";
import type { FC } from "hono/jsx";
import { StorageFile } from "@akujs/aku/storage";
import { app } from "../app";
import { Layout } from "../components/Layout";

export async function StoragePageController(c: Context): Promise<Response> {
	const files = await app.storage.directory("uploads").listFiles();
	const currentPath = new URL(c.req.url).pathname;
	return c.html(<StoragePageView currentPath={currentPath} files={files} />);
}

export async function StorageUploadController(c: Context): Promise<Response> {
	const formData = await c.req.raw.formData();
	const file = formData.get("file");

	if (file && file instanceof File && file.size > 0) {
		await app.storage.directory("uploads").file(file.name).put(file);
	}
	return c.redirect("/aku/storage");
}

export async function StorageDeleteController(c: Context): Promise<Response> {
	const filename = c.req.param("filename");
	if (filename) {
		await app.storage.directory("uploads").file(filename).delete();
	}
	return c.redirect("/aku/storage");
}

interface StoragePageViewProps {
	currentPath: string;
	files: StorageFile[];
}

const StoragePageView: FC<StoragePageViewProps> = ({ currentPath, files }) => (
	<Layout currentPath={currentPath}>
		<h2>Storage</h2>

		<form
			action="/aku/storage/upload"
			method="post"
			enctype="multipart/form-data"
			style="margin-bottom: 20px;"
		>
			<label>
				Select Image:
				<input type="file" name="file" accept="image/*" style="margin-left: 10px;" />
			</label>
			<button type="submit" style="margin-left: 10px;">
				Upload
			</button>
		</form>

		<h3>Uploaded Files:</h3>
		{files.length === 0 ? (
			<p>No files uploaded</p>
		) : (
			<div style="display: flex; flex-wrap: wrap; gap: 20px;">
				{files.map((file) => (
					<FileCard file={file} />
				))}
			</div>
		)}
	</Layout>
);

const FileCard: FC<{ file: StorageFile }> = async ({ file }) => (
	<div style="border: 1px solid #ccc; padding: 10px; text-align: center;">
		<img
			src={await file.url()}
			alt={file.name}
			style="width: 120px; height: 120px; object-fit: cover; display: block; margin-bottom: 8px;"
		/>
		<div style="font-size: 12px; margin-bottom: 8px; word-break: break-all;">{file.name}</div>
		<form action={`/aku/storage/delete/${encodeURIComponent(file.name)}`} method="post">
			<button type="submit" style="font-size: 12px;">
				Delete
			</button>
		</form>
	</div>
);
