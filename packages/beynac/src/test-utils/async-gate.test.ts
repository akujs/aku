import { expect, test } from "bun:test";
import { asyncGate } from "./async-gate.ts";

test("basic checkpoint flow", async () => {
	const checkpoint = asyncGate();
	const events: string[] = [];

	const mainPromise = (async () => {
		events.push("start");
		await checkpoint.block();
		events.push("after block");
	})();

	await checkpoint.hasBlocked();
	expect(events).toEqual(["start"]);

	checkpoint.release();
	await mainPromise;

	expect(events).toEqual(["start", "after block"]);
});

test("release() throws if not blocked", () => {
	const checkpoint = asyncGate();

	expect(() => checkpoint.release()).toThrow("release(): checkpoint is not blocked");
});

test("block() throws if already blocked", async () => {
	const checkpoint = asyncGate();

	const promise1 = checkpoint.block();

	await checkpoint.hasBlocked();
	expect(checkpoint.block()).rejects.toThrow("block() may only be called once");

	checkpoint.release();
	await promise1;
});

test("hasBlocked() waits until blocked", async () => {
	const checkpoint = asyncGate();
	let hasBlockedResolved = false;

	const mainPromise = (async () => {
		await Promise.resolve(); // Yield first
		await Promise.resolve(); // Yield again
		await checkpoint.block();
	})();

	const hasBlockedPromise = checkpoint.hasBlocked().then(() => {
		hasBlockedResolved = true;
	});

	// Should not have resolved yet
	await Promise.resolve();
	expect(hasBlockedResolved).toBe(false);

	// Wait for hasBlocked to resolve
	await hasBlockedPromise;
	expect(hasBlockedResolved).toBe(true);

	checkpoint.release();
	await mainPromise;
});

test("multiple sequential checkpoints", async () => {
	const cp1 = asyncGate();
	const cp2 = asyncGate();
	const events: string[] = [];

	const mainPromise = (async () => {
		events.push("start");
		await cp1.block();
		events.push("after cp1");
		await cp2.block();
		events.push("after cp2");
	})();

	await cp1.hasBlocked();
	expect(events).toEqual(["start"]);

	cp1.release();
	await cp2.hasBlocked();
	expect(events).toEqual(["start", "after cp1"]);

	cp2.release();
	await mainPromise;
	expect(events).toEqual(["start", "after cp1", "after cp2"]);
});

test("multiple concurrent tasks with different checkpoints", async () => {
	const cp1 = asyncGate();
	const cp2 = asyncGate();
	const events: string[] = [];

	const task1 = (async () => {
		events.push("task1: start");
		await cp1.block();
		events.push("task1: after cp1");
	})();

	const task2 = (async () => {
		events.push("task2: start");
		await cp2.block();
		events.push("task2: after cp2");
	})();

	await cp1.hasBlocked();
	await cp2.hasBlocked();
	expect(events).toEqual(["task1: start", "task2: start"]);

	// Release in reverse order
	cp2.release();
	await task2;
	expect(events).toEqual(["task1: start", "task2: start", "task2: after cp2"]);

	cp1.release();
	await task1;
	expect(events).toEqual(["task1: start", "task2: start", "task2: after cp2", "task1: after cp1"]);
});
