import { expect, test } from "bun:test";
import { asyncGate } from "./async-gate.ts";

test("asyncGate throws on empty checkpoints array", () => {
	expect(() => asyncGate([])).toThrow("Checkpoints array cannot be empty");
});

test("asyncGate throws on duplicate checkpoints", () => {
	expect(() => asyncGate(["a", "b", "a"])).toThrow("Checkpoints array contains duplicates");
});

test("task() throws if task name already exists", () => {
	const gate = asyncGate(["a", "b", "c"]);
	gate.task("task1");

	expect(() => gate.task("task1")).toThrow('Task "task1" already exists');
});

test("current() throws if task name doesn't exist", () => {
	const gate = asyncGate(["a", "b", "c"]);

	expect(() => gate.current("unknown")).toThrow("Unknown task: unknown");
});

test("current() returns null when task is not waiting", () => {
	const gate = asyncGate(["a", "b", "c"]);
	gate.task("task1");

	expect(gate.current("task1")).toBe(null);
});

test("checkpoint() throws for unknown checkpoint name", async () => {
	const gate = asyncGate(["a", "b", "c"]);

	expect(gate("unknown")).rejects.toThrow("Unknown checkpoint: unknown");
});

test("next() throws when no more checkpoints", async () => {
	const gate = asyncGate(["a", "b"]);

	await gate.next(); // advance to "a"
	await gate.next(); // advance to "b"

	expect(gate.next()).rejects.toThrow("No more checkpoints");
});

test("basic checkpoint flow", async () => {
	const gate = asyncGate(["init", "process", "cleanup"]);
	const events: string[] = [];

	const task = async () => {
		events.push("start");
		await gate("init");
		events.push("after init");
		await gate("cleanup");
		events.push("after cleanup");
	};

	const taskPromise = task();

	expect(gate.current("default")).toBe("init");
	expect(events).toEqual(["start"]);

	await gate.next();
	expect(gate.current("default")).toBe("cleanup");
	expect(events).toEqual(["start", "after init"]);

	await gate.next();
	expect(gate.current("default")).toBe("cleanup");

	await gate.next();
	await taskPromise;

	expect(gate.current("default")).toBe(null);
	expect(events).toEqual(["start", "after init", "after cleanup"]);
});

test("multiple tasks with different checkpoints", async () => {
	const gate = asyncGate(["init", "process", "cleanup"]);
	const events: string[] = [];

	const checkpoint1 = gate.task("task1");
	const checkpoint2 = gate.task("task2");

	const task1 = async () => {
		events.push("task1: start");
		await checkpoint1("process");
		events.push("task1: after process");
		await checkpoint1("cleanup");
		events.push("task1: after cleanup");
	};

	const task2 = async () => {
		events.push("task2: start");
		await checkpoint2("init");
		events.push("task2: after init");
		await checkpoint2("cleanup");
		events.push("task2: after cleanup");
	};

	const p1 = task1();
	const p2 = task2();

	expect(gate.current("task1")).toBe("process");
	expect(gate.current("task2")).toBe("init");
	expect(events).toEqual(["task1: start", "task2: start"]);

	// Advance to "init" - only task2 should proceed
	await gate.next();
	expect(gate.current("task1")).toBe("process");
	expect(gate.current("task2")).toBe("cleanup");
	expect(events).toEqual(["task1: start", "task2: start", "task2: after init"]);

	// Advance to "process" - task1 should proceed
	await gate.next();
	expect(gate.current("task1")).toBe("cleanup");
	expect(gate.current("task2")).toBe("cleanup");
	expect(events).toEqual([
		"task1: start",
		"task2: start",
		"task2: after init",
		"task1: after process",
	]);

	// Advance to "cleanup" - both should complete
	await gate.next();
	await Promise.all([p1, p2]);

	expect(gate.current("task1")).toBe(null);
	expect(gate.current("task2")).toBe(null);
	expect(events).toEqual([
		"task1: start",
		"task2: start",
		"task2: after init",
		"task1: after process",
		"task1: after cleanup",
		"task2: after cleanup",
	]);
});

test("task can skip checkpoints", async () => {
	const gate = asyncGate(["a", "b", "c", "d"]);
	const events: string[] = [];

	const task = async () => {
		events.push("start");
		await gate("c"); // Skip "a" and "b"
		events.push("after c");
	};

	const taskPromise = task();
	await Promise.resolve();

	expect(gate.current("default")).toBe("c");
	expect(events).toEqual(["start"]);

	// Advance through "a" and "b" - task should still be waiting
	await gate.next(); // to "a"
	expect(gate.current("default")).toBe("c");

	await gate.next(); // to "b"
	expect(gate.current("default")).toBe("c");

	// Advance to "c" - task should proceed
	await gate.next();
	await taskPromise;

	expect(gate.current("default")).toBe(null);
	expect(events).toEqual(["start", "after c"]);
});

test("complex race condition scenario", async () => {
	const gate = asyncGate(["read-start", "write-start", "write-end", "read-end"]);
	const sharedResource: string[] = [];

	const writerCheckpoint = gate.task("writer");
	const readerCheckpoint = gate.task("reader");

	const writer = async () => {
		await writerCheckpoint("write-start");
		sharedResource.push("writing");
		await writerCheckpoint("write-end");
		sharedResource.push("write complete");
	};

	const reader = async () => {
		await readerCheckpoint("read-start");
		sharedResource.push("reading");
		await readerCheckpoint("read-end");
		sharedResource.push("read complete");
	};

	void writer();
	void reader();

	await gate.run();

	// Assert events happened in expected order
	expect(sharedResource).toEqual(["reading", "writing", "write complete", "read complete"]);
});

test("next() waits for task to reach checkpoint", async () => {
	const gate = asyncGate(["a", "b"]);

	let reached = false;
	const task = async () => {
		await Promise.resolve();
		reached = true;
		await gate("b");
	};

	// Start task
	const taskPromise = task();

	// Advance to "a" immediately
	await gate.next();

	// Try to advance to "b" - should wait for task
	await gate.next();
	expect(reached).toBe(true);

	await taskPromise;
});

test("multiple tasks waiting on same checkpoint are all released", async () => {
	const gate = asyncGate(["sync-point"]);
	const events: string[] = [];

	const checkpoint1 = gate.task("task1");
	const checkpoint2 = gate.task("task2");
	const checkpoint3 = gate.task("task3");

	const createTask = (name: string, checkpoint: (name: string) => Promise<void>) => async () => {
		events.push(`${name}: start`);
		await checkpoint("sync-point");
		events.push(`${name}: done`);
	};

	// Start all tasks
	const tasks = [
		createTask("task1", checkpoint1)(),
		createTask("task2", checkpoint2)(),
		createTask("task3", checkpoint3)(),
	];

	await Promise.resolve();

	// All should be waiting
	expect(gate.current("task1")).toBe("sync-point");
	expect(gate.current("task2")).toBe("sync-point");
	expect(gate.current("task3")).toBe("sync-point");
	expect(events).toEqual(["task1: start", "task2: start", "task3: start"]);

	// Release all at once
	await gate.next();
	await Promise.all(tasks);

	// All should have completed
	expect(gate.current("task1")).toBe(null);
	expect(gate.current("task2")).toBe(null);
	expect(gate.current("task3")).toBe(null);
	expect(events).toContain("task1: done");
	expect(events).toContain("task2: done");
	expect(events).toContain("task3: done");
});

test("run() advances through all checkpoints", async () => {
	const gate = asyncGate(["a", "b", "c"]);
	const events: string[] = [];

	const checkpoint1 = gate.task("task1");
	const checkpoint2 = gate.task("task2");

	const task1 = async () => {
		events.push("task1: start");
		await checkpoint1("a");
		events.push("task1: a");
		await checkpoint1("c");
		events.push("task1: c");
	};

	const task2 = async () => {
		events.push("task2: start");
		await checkpoint2("b");
		events.push("task2: b");
		await checkpoint2("c");
		events.push("task2: c");
	};

	// Start tasks
	const p1 = task1();
	const p2 = task2();

	// Run through all checkpoints
	await gate.run();
	await Promise.all([p1, p2]);

	// Verify all checkpoints were hit in order
	expect(events).toEqual([
		"task1: start",
		"task2: start",
		"task1: a",
		"task2: b",
		"task1: c",
		"task2: c",
	]);
});

test("calling gate as a function uses the default task", async () => {
	const gate = asyncGate(["init", "process", "cleanup"]);
	const events: string[] = [];

	const task = async () => {
		events.push("start");
		await gate("init");
		events.push("after init");
		await gate("process");
		events.push("after process");
		await gate("cleanup");
		events.push("after cleanup");
	};

	const taskPromise = task();

	// Verify the default task is being used
	expect(gate.current("default")).toBe("init");
	expect(events).toEqual(["start"]);

	await gate.next();
	expect(gate.current("default")).toBe("process");
	expect(events).toEqual(["start", "after init"]);

	await gate.next();
	expect(gate.current("default")).toBe("cleanup");
	expect(events).toEqual(["start", "after init", "after process"]);

	await gate.next();
	await taskPromise;

	expect(gate.current("default")).toBe(null);
	expect(events).toEqual(["start", "after init", "after process", "after cleanup"]);
});

test("default task throws when used concurrently by multiple processes waiting on same checkpoint", async () => {
	const gate = asyncGate(["step1", "step2", "step3"]);

	const task1 = async () => {
		await gate("step1");
	};

	const task2 = async () => {
		await gate("step1");
	};

	const p1 = task1();
	const p2 = task2();

	expect(Promise.race([p1, p2])).rejects.toThrow(
		"Cannot use default gate() with multiple concurrent processes. Use gate.task() to create separate tasks.",
	);
});

test("default task throws when used concurrently by multiple processes waiting on different checkpoints", async () => {
	const gate = asyncGate(["step1", "step2", "step3"]);

	const task1 = async () => {
		await gate("step1");
	};

	const task2 = async () => {
		await gate("step2");
	};

	const p1 = task1();
	const p2 = task2();

	expect(Promise.race([p1, p2])).rejects.toThrow(
		"Cannot use default gate() with multiple concurrent processes. Use gate.task() to create separate tasks.",
	);
});
