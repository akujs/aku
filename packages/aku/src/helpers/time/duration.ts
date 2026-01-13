/**
 * Parse a duration string into milliseconds
 *
 * Supports duration strings with units:
 * - y (year)
 * - w (week)
 * - d (day)
 * - h (hour)
 * - m (minute)
 * - s (second)
 * - ms (millisecond)
 *
 * Components can appear in any order. Duplicate components throw an error.
 *
 * @param duration - Duration string (e.g., "1h", "5d4h", "1h30m15s", "0ms")
 * @returns Number of milliseconds
 * @throws Error if format is invalid or has duplicate components
 *
 * @example
 * durationStringToMs("1h") // 3600000
 * durationStringToMs("5d4h") // 446400000
 * durationStringToMs("1h30m15s") // 5415000
 * durationStringToMs("0ms") // 0
 */
export function durationStringToMs(duration: string): number {
	// Match any combination of duration components in any order
	// Note: "ms" must come before "m" and "s" in the alternation
	const pattern = /^(?:\d+(?:ms|y|w|d|h|m|s))+$/;

	if (!pattern.test(duration)) {
		throw new Error(
			`Invalid duration format: "${duration}". Expected format like "1h", "5d4h", "1h30m15s"`,
		);
	}

	let totalMs = 0;
	const seenUnits = new Set<string>();
	const componentPattern = /(\d+)(ms|y|w|d|h|m|s)/g;
	let match: RegExpExecArray | null;

	while ((match = componentPattern.exec(duration)) !== null) {
		const value = parseInt(match[1], 10);
		const unit = match[2];

		// Check for duplicate
		if (seenUnits.has(unit)) {
			throw new Error(`Duplicate duration component "${unit}" in "${duration}"`);
		}
		seenUnits.add(unit);

		// Add to total based on unit
		switch (unit) {
			case "y":
				totalMs += value * 365 * 24 * 60 * 60 * 1000;
				break;
			case "w":
				totalMs += value * 7 * 24 * 60 * 60 * 1000;
				break;
			case "d":
				totalMs += value * 24 * 60 * 60 * 1000;
				break;
			case "h":
				totalMs += value * 60 * 60 * 1000;
				break;
			case "m":
				totalMs += value * 60 * 1000;
				break;
			case "s":
				totalMs += value * 1000;
				break;
			case "ms":
				totalMs += value;
				break;
		}
	}

	return totalMs;
}

/**
 * Parse a duration string into a Date. You can also pass a Date object.
 *
 * @param duration - Duration string (e.g., "1h", "5d4h") or Date object
 * @param options - Options object with optional relativeTo date and inPast flag
 * @returns Date object representing the calculated time
 * @throws Error if format is invalid or has duplicate components
 *
 * @example
 * durationStringToDate("1h") // Date 1 hour from now
 * durationStringToDate("1h", { inPast: true }) // Date 1 hour ago
 * durationStringToDate("1h", { relativeTo: new Date("2025-01-01") }) // 2025-01-01 plus 1 hour
 * durationStringToDate("1h", { relativeTo: new Date("2025-01-01"), inPast: true }) // 2025-01-01 minus 1 hour
 * durationStringToDate(new Date("2025-12-31")) // Date("2025-12-31")
 */
export function durationStringToDate(
	duration: string | Date,
	options?: { relativeTo?: Date; inPast?: boolean },
): Date {
	// If already a Date, return it
	if (duration instanceof Date) {
		return new Date(duration);
	}

	const ms = durationStringToMs(duration);
	const baseTime = options?.relativeTo?.getTime() ?? Date.now();
	const multiplier = options?.inPast ? -1 : 1;
	return new Date(baseTime + ms * multiplier);
}
