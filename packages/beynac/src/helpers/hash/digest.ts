import { createHash } from "node:crypto";
import { mockable } from "../../testing/mocks.ts";

type HashEncoding = "hex" | "base64";

type DigestHashFunction = (data: string | Uint8Array, encoding?: HashEncoding) => string;

/**
 * Hash data using SHA-256
 */
export const sha256: DigestHashFunction = digestImpl("sha256");

/**
 * Hash data using SHA-512
 */
export const sha512: DigestHashFunction = digestImpl("sha512");

/**
 * Hash data using SHA3-256
 */
export const sha3_256: DigestHashFunction = digestImpl("sha3-256");

/**
 * Hash data using SHA3-512
 */
export const sha3_512: DigestHashFunction = digestImpl("sha3-512");

/**
 * Hash data using MD5
 */
export const md5: DigestHashFunction = digestImpl("md5");

function digestImpl(algorithm: string) {
	return mockable(
		function (data: string | Uint8Array, encoding: HashEncoding = "hex"): string {
			const hash = createHash(algorithm);
			hash.update(data);
			return hash.digest(encoding);
		},
		algorithm.replaceAll("-", "_"),
	);
}
