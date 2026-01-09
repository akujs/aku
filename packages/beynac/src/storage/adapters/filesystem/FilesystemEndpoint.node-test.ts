import * as assert from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { platform } from "../../path-operations.ts";
import { FilesystemEndpoint } from "./FilesystemEndpoint.ts";

// IMPORTANT: This file contains Node.js-specific tests for filesystem storage.
// Some behaviours differ between Bun and Node.js - notably, Node.js auto-closes
// directory handles after `for await...of` iteration, which can cause issues
// if we try to close them again in a finally block.

void test("listEntries does not throw ERR_DIR_CLOSED after iteration completes", async () => {
	const tempDir = createTestDirectory({ prefix: "fs-node-test-" });
	const uploadsDir = platform.join(tempDir, "uploads");
	mkdirSync(uploadsDir, { recursive: true });

	// Create some test files
	writeFileSync(platform.join(uploadsDir, "file1.txt"), "content1");
	writeFileSync(platform.join(uploadsDir, "file2.txt"), "content2");
	writeFileSync(platform.join(uploadsDir, "file3.txt"), "content3");

	const storage = new FilesystemEndpoint({ rootPath: tempDir });

	// This should not throw ERR_DIR_CLOSED
	const entries: string[] = [];
	for await (const entry of storage.listEntries("/uploads/")) {
		entries.push(entry);
	}

	assert.strictEqual(entries.length, 3);
	assert.ok(entries.includes("file1.txt"));
	assert.ok(entries.includes("file2.txt"));
	assert.ok(entries.includes("file3.txt"));
});

void test("listFilesRecursive does not throw ERR_DIR_CLOSED after iteration completes", async () => {
	const tempDir = createTestDirectory({ prefix: "fs-node-test-recursive-" });
	const uploadsDir = platform.join(tempDir, "uploads");
	const subDir = platform.join(uploadsDir, "subdir");
	mkdirSync(subDir, { recursive: true });

	// Create test files in nested structure
	writeFileSync(platform.join(uploadsDir, "file1.txt"), "content1");
	writeFileSync(platform.join(subDir, "file2.txt"), "content2");

	const storage = new FilesystemEndpoint({ rootPath: tempDir });

	// This should not throw ERR_DIR_CLOSED
	const entries: string[] = [];
	for await (const entry of storage.listFilesRecursive("/uploads/")) {
		entries.push(entry);
	}

	assert.strictEqual(entries.length, 2);
});

void test("existsAnyUnderPrefix does not throw ERR_DIR_CLOSED", async () => {
	const tempDir = createTestDirectory({ prefix: "fs-node-test-exists-" });
	const uploadsDir = platform.join(tempDir, "uploads");
	mkdirSync(uploadsDir, { recursive: true });
	writeFileSync(platform.join(uploadsDir, "file.txt"), "content");

	const storage = new FilesystemEndpoint({ rootPath: tempDir });

	// This should not throw ERR_DIR_CLOSED
	const exists = await storage.existsAnyUnderPrefix("/uploads/");
	assert.strictEqual(exists, true);
});
