/** @jsxImportSource beynac/view **/
import { type Controller, redirect } from "beynac/http";
import { StorageFile } from "beynac/storage";
import type { Component } from "beynac/view";
import { app } from "../app";
import { Layout } from "../components/Layout";

export const StoragePageController: Controller = async ({ url }) => {
	const files = await app.storage.directory("/uploads").listFiles();
	return <StoragePageView currentPath={url.pathname} files={files} />;
};

export const StorageUploadController: Controller = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get("file");

	if (file && file instanceof File && file.size > 0) {
		const path = `/uploads/${file.name}`;
		await app.storage.file(path).put(file);
	}
	return redirect("/beynac/storage");
};

export const StorageDeleteController: Controller = async ({ params }) => {
	const { filename } = params;
	if (filename) {
		const path = `/uploads/${filename}`;
		await app.storage.file(path).delete();
	}
	return redirect("/beynac/storage");
};

interface StoragePageViewProps {
	currentPath: string;
	files: StorageFile[];
}

const StoragePageView: Component<StoragePageViewProps> = ({ currentPath, files }) => (
	<Layout currentPath={currentPath}>
		<h2>Storage</h2>

		<form
			action="/beynac/storage/upload"
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

const FileCard: Component<{ file: StorageFile }> = async ({ file }) => (
	<div style="border: 1px solid #ccc; padding: 10px; text-align: center;">
		<img
			src={await file.url()}
			alt={file.name}
			style="width: 120px; height: 120px; object-fit: cover; display: block; margin-bottom: 8px;"
		/>
		<div style="font-size: 12px; margin-bottom: 8px; word-break: break-all;">{file.name}</div>
		<form action={`/beynac/storage/delete/${encodeURIComponent(file.name)}`} method="post">
			<button type="submit" style="font-size: 12px;">
				Delete
			</button>
		</form>
	</div>
);
