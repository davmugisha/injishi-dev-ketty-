/**
 * SHA-256 of a string's UTF-8 bytes, as 64 lower case hex characters.
 *
 * Written out here rather than taken from `node:crypto` or `crypto.subtle`,
 * because the lease fingerprint has to be the same synchronous function in the
 * API, in a server component and in the browser that shows the signer what
 * they are signing. The tests check it against `node:crypto`.
 */
/** A string as UTF-8 bytes. A lone surrogate becomes U+FFFD, as `TextEncoder` and Node do. */
export declare function utf8Bytes(text: string): Uint8Array;
/** SHA-256 of `text` (UTF-8), as lower case hex. */
export declare function sha256Hex(text: string): string;
//# sourceMappingURL=sha256.d.ts.map