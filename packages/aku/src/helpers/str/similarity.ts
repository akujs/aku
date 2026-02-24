const array: number[] = [];
const characterCodeCache: number[] = [];

/**
 * Calculate the Levenshtein distance between two strings.
 *
 * Based on [leven](https://github.com/sindresorhus/leven) by Sindre Sorhus (MIT licence).
 * Uses the Wagner-Fischer dynamic programming algorithm with single-row optimisation,
 * prefix/suffix trimming, and character code caching.
 *
 * @param options.maxDistance - Return this value early if the true distance exceeds it
 */
export function levenshteinDistance(
	a: string,
	b: string,
	options?: { maxDistance?: number | undefined },
): number {
	if (a === b) {
		return 0;
	}

	const maxDistance = options?.maxDistance ?? Infinity;

	// Ensure `a` is the shorter string
	if (a.length > b.length) {
		const swap = a;
		a = b;
		b = swap;
	}

	let aLength = a.length;
	let bLength = b.length;

	// Suffix trimming: drop common suffix characters
	while (aLength > 0 && a.charCodeAt(aLength - 1) === b.charCodeAt(bLength - 1)) {
		aLength--;
		bLength--;
	}

	// Prefix trimming: drop common prefix characters
	let start = 0;
	while (start < aLength && a.charCodeAt(start) === b.charCodeAt(start)) {
		start++;
	}

	aLength -= start;
	bLength -= start;

	// Early termination: length difference alone exceeds maxDistance
	if (maxDistance !== undefined && bLength - aLength > maxDistance) {
		return maxDistance;
	}

	if (aLength === 0) {
		return maxDistance !== undefined && bLength > maxDistance ? maxDistance : bLength;
	}

	let bCharacterCode: number;
	let result = 0;
	let temporary: number;
	let temporary2: number;
	let index = 0;
	let index2 = 0;

	while (index < aLength) {
		characterCodeCache[index] = a.charCodeAt(start + index);
		array[index] = ++index;
	}

	while (index2 < bLength) {
		bCharacterCode = b.charCodeAt(start + index2);
		temporary = index2++;
		result = index2;

		for (index = 0; index < aLength; index++) {
			temporary2 = bCharacterCode === characterCodeCache[index] ? temporary : temporary + 1;
			temporary = array[index]!;
			result = array[index] =
				temporary > result
					? temporary2 > result
						? result + 1
						: temporary2
					: temporary2 > temporary
						? temporary + 1
						: temporary2;
		}

		// Early termination: all values in current row exceed maxDistance
		if (maxDistance !== undefined) {
			let rowMinimum = result;
			for (index = 0; index < aLength; index++) {
				if (array[index]! < rowMinimum) {
					rowMinimum = array[index]!;
				}
			}

			if (rowMinimum > maxDistance) {
				return maxDistance;
			}
		}
	}

	// Bound arrays to avoid retaining large previous sizes
	array.length = aLength;
	characterCodeCache.length = aLength;

	return maxDistance !== undefined && result > maxDistance ? maxDistance : result;
}

/**
 * Find strings from `candidates` that are similar to `target`, ranked by Levenshtein distance.
 *
 * Candidates with a distance less than or equal to `threshold` are returned, sorted by
 * distance (lowest first) with alphabetical tie-breaking.
 *
 * @param options.threshold - Maximum edit distance to consider a match (default: 3)
 * @param options.maxResults - Maximum number of results to return (default: 3)
 */
export function findSimilar(
	target: string,
	candidates: string[],
	options?: { threshold?: number | undefined; maxResults?: number | undefined },
): string[] {
	const threshold = options?.threshold ?? 3;
	const maxResults = options?.maxResults ?? 3;

	const matches: Array<{ candidate: string; distance: number }> = [];

	for (const candidate of candidates) {
		const distance = levenshteinDistance(target, candidate, {
			maxDistance: threshold + 1,
		});
		if (distance <= threshold) {
			matches.push({ candidate, distance });
		}
	}

	matches.sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));

	return matches.slice(0, maxResults).map((m) => m.candidate);
}
