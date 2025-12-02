import { beforeEach, describe, expect, test } from "bun:test";
import { mockDispatcher } from "../../../test-utils/internal-mocks.ts";
import { fsOps, mockFilesystemOperations } from "../../filesystem-operations.ts";
import { mockPlatformPaths } from "../../path-operations.ts";
import { StorageImpl } from "../../StorageImpl.ts";
import { MockFilesystemOperations, mockEndpointBuilder } from "../../storage-test-utils.ts";
import { FilesystemEndpoint } from "./FilesystemEndpoint.ts";

describe(FilesystemEndpoint, () => {
	beforeEach(() => {
		mockFilesystemOperations(new MockFilesystemOperations());
	});

	const createDisk = (rootPath: string) => {
		const storage = new StorageImpl({}, mockDispatcher(), mockEndpointBuilder());
		const endpoint = new FilesystemEndpoint({ rootPath });
		const disk = storage.build(endpoint);
		return { disk, endpoint, storage };
	};

	describe("Windows paths", () => {
		beforeEach(() => {
			mockPlatformPaths("win32");
		});

		test("file.info() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.info();

			expect(fsOps.stat).toHaveBeenCalledTimes(1);
			expect(fsOps.stat).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("Windows filesystem path work with drive prefix", async () => {
			const { disk } = createDisk("D:");
			const file = disk.directory("foo").file("bar.txt");

			await file.info();

			expect(fsOps.stat).toHaveBeenCalledTimes(1);
			expect(fsOps.stat).toHaveBeenCalledWith("D:\\foo\\bar.txt");
		});

		test("Windows filesystem path work with slash-terminated root", async () => {
			const { disk } = createDisk("C:\\storage\\");
			const file = disk.directory("foo").file("bar.txt");

			await file.info();

			expect(fsOps.stat).toHaveBeenCalledTimes(1);
			expect(fsOps.stat).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("Windows filesystem paths work when input to directory() and file() are windows paths", async () => {
			const { disk } = createDisk("C:\\storage\\");
			const file = disk.directory("foo\\bar\\").file("quux\\baz.txt");

			await file.info();

			expect(fsOps.stat).toHaveBeenCalledTimes(1);
			expect(fsOps.stat).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\quux\\baz.txt");
		});

		test("Windows filesystem path work with mixed-slash root", async () => {
			const { disk } = createDisk("C:\\storage/dir");
			const file = disk.directory("foo").file("bar.txt");

			await file.info();

			expect(fsOps.stat).toHaveBeenCalledTimes(1);
			expect(fsOps.stat).toHaveBeenCalledWith("C:\\storage\\dir\\foo\\bar.txt");
		});

		test("file.exists() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.exists();

			expect(fsOps.access).toHaveBeenCalledTimes(1);
			expect(fsOps.access).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("file.delete() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.delete();

			expect(fsOps.unlink).toHaveBeenCalledTimes(1);
			expect(fsOps.unlink).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("file.get() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.get();

			expect(fsOps.stat).toHaveBeenCalledTimes(1);
			expect(fsOps.stat).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("file.put() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.put("content");

			expect(fsOps.mkdir).toHaveBeenCalledWith("C:\\storage\\foo", { recursive: true });
			expect(fsOps.createWriteStream).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("file.copyTo() converts POSIX storage paths to Windows filesystem paths", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");
			const dest = disk.directory("dest").file("copied.txt");

			await file.copyTo(dest);

			expect(fsOps.mkdir).toHaveBeenCalledWith("C:\\storage\\dest", { recursive: true });
			expect(fsOps.copyFile).toHaveBeenCalledWith(
				"C:\\storage\\foo\\bar.txt",
				"C:\\storage\\dest\\copied.txt",
			);
		});

		test("file.moveTo() converts POSIX storage paths to Windows filesystem paths", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");
			const dest = disk.directory("dest").file("moved.txt");

			await file.moveTo(dest);

			expect(fsOps.mkdir).toHaveBeenCalledWith("C:\\storage\\dest", { recursive: true });
			expect(fsOps.rename).toHaveBeenCalledWith(
				"C:\\storage\\foo\\bar.txt",
				"C:\\storage\\dest\\moved.txt",
			);
		});

		test("directory.exists() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.exists();

			// existsAnyUnderPrefix calls opendir to check for any entries
			expect(fsOps.opendir).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\");
		});

		test("directory.list() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.list();

			expect(fsOps.opendir).toHaveBeenCalledTimes(1);
			expect(fsOps.opendir).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\");
		});

		test("directory.listFiles() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.listFiles();

			expect(fsOps.opendir).toHaveBeenCalledTimes(1);
			expect(fsOps.opendir).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\");
		});

		test("directory.listFiles({recursive:true}) converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.listFiles({ recursive: true });

			expect(fsOps.opendir).toHaveBeenCalledTimes(1);
			expect(fsOps.opendir).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\");
		});

		test("directory.deleteAll() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.deleteAll();

			expect(fsOps.rm).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\", {
				recursive: true,
				force: true,
			});
		});
	});
});
