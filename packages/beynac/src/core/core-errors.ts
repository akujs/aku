/**
 * Base class for all Beynac errors
 */
export class BeynacError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}

	override toString(): string {
		const extra = this.getToStringExtra();
		if (extra) {
			return `[${this.constructor.name} ${extra}: ${this.message}]`;
		}
		return `[${this.constructor.name}: ${this.message}]`;
	}

	protected getToStringExtra(): string | undefined {
		return undefined;
	}
}
