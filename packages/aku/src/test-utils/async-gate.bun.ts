/**
 * Create a checkpoint for coordinating async test code.
 *
 * Example:
 *   const checkpoint = asyncGate();
 *
 *   const mainPromise = (async () => {
 *     // do setup
 *     await checkpoint.block();
 *     // do work after release
 *   })();
 *
 *   await checkpoint.hasBlocked();  // wait for code to reach the checkpoint
 *   // assert intermediate state here
 *   checkpoint.release();           // let code continue
 *   await mainPromise;              // wait for completion
 */
export function asyncGate(): AsyncGateImpl {
	return new AsyncGateImpl();
}

class AsyncGateImpl {
	private isBlocked = false;
	private blockResolver: (() => void) | null = null;
	private hasBlockedResolver: (() => void) | null = null;

	async block(): Promise<void> {
		if (this.blockResolver) {
			throw new Error("block() may only be called once.");
		}
		this.isBlocked = true;

		if (this.hasBlockedResolver) {
			this.hasBlockedResolver();
		}

		await new Promise<void>((resolve) => {
			this.blockResolver = resolve;
		});

		this.isBlocked = false;
	}

	/**
	 * Block the first time this is called, then ignore all subsequent calls.
	 */
	async blockFirstTime(): Promise<void> {
		if (this.blockResolver) {
			return;
		}
		return this.block();
	}

	async hasBlocked(): Promise<void> {
		if (this.hasBlockedResolver) {
			throw new Error("hasBlocked() may only be called once");
		}
		const hasBlockedPromise = new Promise<void>((resolve) => {
			this.hasBlockedResolver = resolve;
		});
		if (this.isBlocked) {
			this.hasBlockedResolver!();
		} else if (this.blockResolver) {
			throw new Error(
				"hasBlocked() will never resolve because the checkpoint has already been released",
			);
		}
		return hasBlockedPromise;
	}

	release(): void {
		if (!this.isBlocked || !this.blockResolver) {
			throw new Error("release(): checkpoint is not blocked");
		}
		this.blockResolver();
	}

	releaseAndWaitTick(): Promise<void> {
		this.release();
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	}
}
