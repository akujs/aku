import { sleep } from "../utils.ts";

type CheckpointFunction = (name: string) => Promise<void>;

type AsyncGate = {
	(name: string): Promise<void>; // Make the gate itself callable
	task(name: string): CheckpointFunction;
	next(): Promise<void>;
	current(taskName: string): string | null;
	run(): Promise<void>;
};

interface TaskState {
	waitingOn: string | null;
	resolver: (() => void) | null;
}

/**
 * Create a new async gate for testing synchronization between async functions.
 *
 * Example controlling a single async function:
 *   const gate = asyncGate(['init', 'process', 'cleanup']);
 *
 *   const task = async () => {
 *     await gate('init');
 *     // do work
 *     await gate('process');
 *   };
 *
 *   const p = task();
 *   await gate.next(); // advance to 'init'
 *   await gate.next(); // advance to 'process'
 *
 * Example coordinating multiple tasks:
 *   const gate = asyncGate(['step1', 'step2', 'step3']);
 *   const task1 = gate.task('task1');
 *   const task2 = gate.task('task2');
 *   // ... use e.g. `await task1('step1')` and `await task2('step3')` in separate async functions
 */
export function asyncGate(checkpoints: string[]): AsyncGate {
	if (checkpoints.length === 0) {
		throw new Error("Checkpoints array cannot be empty");
	}

	const uniqueCheckpoints = new Set(checkpoints);
	if (uniqueCheckpoints.size !== checkpoints.length) {
		throw new Error("Checkpoints array contains duplicates");
	}

	let currentIndex = -1;
	const tasks = new Map<string, TaskState>();
	const nextResolvers = new Set<() => void>();

	const task = (name: string): CheckpointFunction => {
		if (tasks.has(name)) {
			throw new Error(`Task "${name}" already exists`);
		}

		tasks.set(name, {
			waitingOn: null,
			resolver: null,
		});

		return async (checkpointName: string) => {
			const index = checkpoints.indexOf(checkpointName);
			if (index === -1) {
				throw new Error(`Unknown checkpoint: ${checkpointName}`);
			}

			const taskState = tasks.get(name);
			if (!taskState) {
				throw new Error(`Task "${name}" not found`);
			}

			// Wait until this checkpoint is current or passed
			while (currentIndex < index) {
				// Check for concurrent usage of default task
				if (name === "default" && taskState.resolver !== null) {
					throw new Error(
						"Cannot use default gate() with multiple concurrent processes. Use gate.task() to create separate tasks.",
					);
				}

				taskState.waitingOn = checkpointName;

				// Notify any waiting next() calls
				for (const resolve of nextResolvers) {
					resolve();
				}
				nextResolvers.clear();

				// Wait to be released
				await new Promise<void>((resolve) => {
					taskState.resolver = resolve;
				});
			}

			// Clear waiting state
			taskState.waitingOn = null;
			taskState.resolver = null;
		};
	};

	const next = async (): Promise<void> => {
		currentIndex++;

		if (currentIndex >= checkpoints.length) {
			throw new Error("No more checkpoints");
		}

		const currentCheckpoint = checkpoints[currentIndex];
		// Wait for tasks to arrive if not at last checkpoint
		if (currentIndex < checkpoints.length - 1 && tasks.size > 0) {
			// Check if we need to wait for any task to reach this checkpoint
			const isAnyTaskWaitingHere = Array.from(tasks.values()).some(
				(taskState) => taskState.waitingOn === currentCheckpoint,
			);

			if (!isAnyTaskWaitingHere) {
				// Check if any task might reach this checkpoint
				const willAnyTaskReachHere = Array.from(tasks.values()).some((taskState) => {
					if (!taskState.waitingOn) {
						// Task not waiting yet - might reach this checkpoint
						return true;
					}
					// Task is waiting on this exact checkpoint
					return taskState.waitingOn === currentCheckpoint;
				});

				if (willAnyTaskReachHere) {
					// Wait for a task to arrive
					await new Promise<void>((resolve) => {
						nextResolvers.add(resolve);
					});
				}
			}

			// Add a little delay to give async tasks the time do do stuff
			await nextTick();
		}

		// Release all tasks waiting on this checkpoint
		const tasksToRelease: Array<() => void> = [];
		for (const taskState of tasks.values()) {
			if (taskState.resolver && taskState.waitingOn === currentCheckpoint) {
				tasksToRelease.push(taskState.resolver);
				taskState.resolver = null;
			}
		}

		// Release them all at once
		tasksToRelease.forEach((resolve) => resolve());

		// Wait for released tasks to update their state - setTimeout(0) ensures we
		// run on the next tick, even if multiple microtasks have to run
		if (tasksToRelease.length > 0) {
			await sleep(0);
		}
	};

	const current = (taskName: string): string | null => {
		const taskState = tasks.get(taskName);
		if (!taskState) {
			throw new Error(`Unknown task: ${taskName}`);
		}
		return taskState.waitingOn;
	};

	const run = async (): Promise<void> => {
		while (currentIndex < checkpoints.length - 1) {
			await next();
		}
	};

	let defaultTask: CheckpointFunction | null = null;

	// Create the callable gate object
	const gate = Object.assign(
		async (checkpointName: string): Promise<void> => {
			// Lazily create the default task
			if (!defaultTask) {
				defaultTask = task("default");
			}
			return defaultTask(checkpointName);
		},
		{
			task,
			next,
			current,
			run,
		},
	) as AsyncGate;

	return gate;
}

export const nextTick = (): Promise<void> => sleep(0);
