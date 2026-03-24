import { encode } from "@toon-format/toon";

/**
 * Encode a value as a TOON format string.
 *
 * TOON is a human-readable data serialisation format. See https://toon-format.org
 * for the specification.
 */
export function formatToon(value: unknown): string {
	return encode(value);
}
