/**
 * The one QR encoder in this workspace (ADR-049, slice 1 item 2).
 *
 * Single entry point, like `@injishi/contracts`: everything public is exported
 * from here, so a consumer never reaches into a file path. Two consumers exist
 * and they run in different places — the RRA receipt renders in `apps/web` on a
 * server, in a browser and in a print preview, and the training certificate
 * renders on the API inside `pdf-lib`. That is the whole reason this is a
 * package rather than a file in one of them: a second copy is how the two
 * eventually disagree about the same standard.
 *
 * WHY `tsconfig.json` ASKS FOR THE `DOM` LIB. The encoder uses `TextEncoder` to
 * turn the payload into UTF-8 bytes. That global is real in both places this
 * runs — every browser and every supported Node — but `lib: ["ES2020"]` alone
 * declares neither, and it compiled inside `apps/web` only because a Next app
 * already asks for `DOM`. `DOM` is the smaller of the two ways to name it: the
 * alternative is a dependency on `@types/node` in a package that deliberately
 * has no dependencies at all. Nothing in the public surface below mentions a
 * DOM type, so no consumer inherits one.
 */
export { encodeQr } from "./qr-encode";
export type { QrSymbol } from "./qr-encode";
//# sourceMappingURL=index.d.ts.map