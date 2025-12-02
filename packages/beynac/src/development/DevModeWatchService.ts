import { type FSWatcher, watch } from "node:fs";
import { inject } from "../container/inject.ts";
import { Configuration } from "../core/contracts/Configuration.ts";
import { BaseClass, pluralCount } from "../utils.ts";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware.ts";

declare global {
	// oxlint-disable-next-line no-var -- var declaration required for mutable global variable
	var __beynacWatchService: DevModeWatchService | undefined;
}

export class DevModeWatchService extends BaseClass {
	#started = false;
	#destroyed = false;
	#filesChanged: string[] = [];
	private watchers: FSWatcher[] = [];
	private debounceTimer: NodeJS.Timeout | null = null;

	constructor(
		private config: Configuration = inject(Configuration),
		private middleware: DevModeAutoRefreshMiddleware = inject(DevModeAutoRefreshMiddleware),
	) {
		super();
	}

	start(): void {
		if (this.#started || this.#destroyed) return;
		this.#started = true;

		if (globalThis.__beynacWatchService) {
			globalThis.__beynacWatchService.destroy();
		}
		globalThis.__beynacWatchService = this;

		const paths = this.config.devMode?.autoRefreshPaths ?? [process.cwd()];

		if (paths.length === 0) {
			// TODO: Connect to logging mechanism when available
			// eslint-disable-next-line no-console
			console.log(`${DevModeWatchService.name} list of paths to watch is empty`);
		}

		// TODO: Connect to logging mechanism when available
		// eslint-disable-next-line no-console
		console.log(`${DevModeWatchService.name} watching: ${paths.join(", ")}`);

		for (const path of paths) {
			const watcher = watch(path, { recursive: true }, (eventType, filename) => {
				this.#handleFileChange(eventType, filename);
			});
			this.watchers.push(watcher);
		}
	}

	destroy(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		for (const watcher of this.watchers) {
			watcher.close();
		}
		this.watchers = [];

		this.middleware.destroy();

		if (globalThis.__beynacWatchService === this) {
			globalThis.__beynacWatchService = undefined;
		}
	}

	#handleFileChange(_eventType: string, filename: string | null): void {
		if (!filename) {
			return;
		}
		const pattern = this.config.devMode?.autoRefreshPathPattern ?? /\bbeynac\b/i;
		if (!pattern.test(filename)) {
			return;
		}
		this.#filesChanged.push(filename);

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		const debounceMs = this.config.devMode?.autoRefreshDebounceMs ?? 300;
		this.debounceTimer = setTimeout(() => {
			const [first, ...rest] = this.#filesChanged;
			this.#filesChanged = [];
			if (!first) return;
			let message = first;
			if (rest.length > 0) {
				message += ` and ${pluralCount(rest.length, "other")}`;
			}
			// TODO: Connect to logging mechanism when available
			// eslint-disable-next-line no-console
			console.log(`${DevModeWatchService.name} ${message} changed, reloading`);
			this.middleware.triggerReload();
			this.debounceTimer = null;
		}, debounceMs);
	}
}
