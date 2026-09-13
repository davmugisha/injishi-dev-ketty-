/**
 * A QR Code encoder, written by hand because nothing in this workspace ships one.
 *
 * WHY THIS FILE EXISTS AT ALL. Clause 7.24.7 of the RRA's "Technical
 * Specification of CIS for VSDC" requires a QR code on every receipt, carrying
 * `invoice_date#time#sdc number#sdc_receipt_number#internal_data#receipt_signature`.
 * A tax officer holds a phone against the paper and expects the string back.
 * Printing that string as text instead is not a smaller version of the
 * requirement, it is a different document — so the payload has to be really
 * encoded, and no dependency in `apps/web` could do it.
 *
 * WHY NOT A THIRD PARTY ONE. The receipt has to render the same bits on a
 * server, in a browser and in a print preview, and a self-contained pure
 * function is the only version of that with nothing to configure.
 *
 * WHY IT LIVES IN A PACKAGE NOW. It was a file inside `apps/web`, and the
 * reason recorded here for that was ownership: the receipt leaf did not own
 * `package.json` or the lockfile. ADR-049 gave the encoder a second consumer
 * that does not run in `apps/web` at all — the training certificate, rendered
 * on the API inside `pdf-lib` — so the choice stopped being "one file or one
 * dependency" and became "one implementation or two". Two hand-written
 * encoders of the same standard is the version of this that fails an audit, so
 * it moved to `@injishi/qr` and both sides import it. Nothing about the
 * encoding changed in the move.
 *
 * WHAT IT IMPLEMENTS. ISO/IEC 18004 byte mode at error-correction level M
 * (~15% recovery), versions 1 to 40, with the mask chosen by the standard's own
 * penalty rules. Level M rather than L because a receipt is printed on thermal
 * paper that creases, smudges and fades, and rather than Q or H because those
 * cost modules — a denser symbol on 80mm paper is the failure mode that
 * actually happens.
 *
 * HOW IT IS KNOWN TO BE RIGHT. Not by reading it. The module matrix this
 * produces was compared bit for bit against `segno`, an independent reference
 * encoder, across every version, and the rendered symbols were decoded back to
 * their input with OpenCV. Both are recorded in the leaf report. A hand-written
 * encoder that is nearly right produces a symbol that scans on a good phone in
 * good light and fails on the audit, which is the worst possible outcome, so
 * "it looked fine" was never the standard here.
 *
 * Everything below is the specification's own vocabulary. The numeric tables
 * are ISO/IEC 18004 tables and are not derivable; they are transcribed.
 */
/** A finished symbol: `modules[row][col]`, 1 dark, plus its version. */
export interface QrSymbol {
    size: number;
    version: number;
    modules: ReadonlyArray<ReadonlyArray<0 | 1>>;
}
/**
 * Encode `text` as a QR symbol at error-correction level M.
 *
 * UTF-8 rather than ISO-8859-1: the payload of clause 7.24.7 is ASCII by
 * construction, and every scanner reads a byte-mode symbol as UTF-8 when it is
 * valid UTF-8, so the two agree on every input this ever sees and only UTF-8
 * survives a value that turns out not to be ASCII after all.
 */
export declare function encodeQr(text: string): QrSymbol;
//# sourceMappingURL=qr-encode.d.ts.map