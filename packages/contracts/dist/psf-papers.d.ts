/**
 * How a PSF member's papers look (2026-11-06), shared so the PDF the API draws and the certificate
 * the tracking page shows cannot drift apart: each level's colours, and the line pattern that the
 * membership number gives each member.
 */
export interface PsfLevelColours {
    ground: string;
    ground2: string;
    accent: string;
}
export declare function psfLevelColours(levelCode: string): PsfLevelColours;
/**
 * The member's own line pattern, from their membership number: which figure, where, how many lines
 * and how far apart. SVG paths for a box of `w` by `h`, counted from its top left; whoever draws them
 * cuts them off at the edge of that box.
 */
export declare function psfPaperPattern(number: string, w: number, h: number): {
    paths: string[];
    strokeWidth: number;
};
/**
 * The band of fine lines down the card's left (2026-11-06, the owner's second reference), centred on x = 0
 * and never wider than 40 either side. The membership number picks the figure, how many lines, how far
 * apart, where they turn and which way up, so each member's differs:
 *  - two sets of lines, one from each edge of the card, that turn and meet on a centre line;
 *  - or two sets of arches, one hanging from the top, one rising from the bottom, side by side.
 */
export declare function psfCardBand(number: string, h: number): {
    paths: string[];
    strokeWidth: number;
};
/**
 * A honeycomb for the back of the card (the owner's reference), offset by the membership number: an outline
 * for each cell, and a few cells picked out.
 */
export declare function psfCardHoneycomb(number: string, w: number, h: number): {
    outlines: string[];
    filled: string[];
};
//# sourceMappingURL=psf-papers.d.ts.map