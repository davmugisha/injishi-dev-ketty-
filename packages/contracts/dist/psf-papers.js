"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.psfLevelColours = psfLevelColours;
exports.psfPaperPattern = psfPaperPattern;
exports.psfCardBand = psfCardBand;
exports.psfCardHoneycomb = psfCardHoneycomb;
/** Each level's colours. Golden Circle keeps the black and gold of PSF's own card. */
const LEVEL_COLOURS = {
    golden_circle: { ground: "#14141c", ground2: "#23232e", accent: "#d9be6d" },
    indashyikirwa: { ground: "#0b3a2c", ground2: "#124c3a", accent: "#e6cc92" },
    indatwa: { ground: "#16264d", ground2: "#1f3566", accent: "#f39a3d" },
};
/** For a level PSF adds later: it gets one of these, always the same one. */
const SPARE_COLOURS = [
    { ground: "#0f3d4c", ground2: "#17525f", accent: "#7fd6c8" },
    { ground: "#47151f", ground2: "#5c1f2c", accent: "#ecbfa6" },
    { ground: "#2a1148", ground2: "#3a1a60", accent: "#cdb0ff" },
    { ground: "#2b2f36", ground2: "#3a3f48", accent: "#c7ccd4" },
];
/** A steady number from a text: the same member always gets the same pattern. */
function seedOf(text) {
    let h = 2166136261;
    for (const ch of text) {
        h ^= ch.codePointAt(0) ?? 0;
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function psfLevelColours(levelCode) {
    return LEVEL_COLOURS[levelCode] ?? SPARE_COLOURS[seedOf(levelCode) % SPARE_COLOURS.length];
}
/**
 * The member's own line pattern, from their membership number: which figure, where, how many lines
 * and how far apart. SVG paths for a box of `w` by `h`, counted from its top left; whoever draws them
 * cuts them off at the edge of that box.
 */
function psfPaperPattern(number, w, h) {
    let state = seedOf(number) || 1;
    const next = () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return state / 4294967296;
    };
    const between = (a, b) => a + (b - a) * next();
    const lines = Math.round(between(6, 11));
    const gap = between(0.018, 0.03) * h;
    const figure = Math.floor(next() * 3);
    const paths = [];
    if (figure === 0) {
        // Lines that come down, turn and go back up.
        const cx = between(0.32, 0.72) * w;
        const top = between(0.3, 0.55) * h;
        for (let i = 0; i < lines; i += 1) {
            const r = gap * (i + 2);
            paths.push(`M ${cx - r} ${-h * 0.05} L ${cx - r} ${top} A ${r} ${r} 0 0 0 ${cx + r} ${top} L ${cx + r} ${-h * 0.05}`);
        }
        const cx2 = cx + between(0.1, 0.22) * w;
        const low = top + between(0.12, 0.25) * h;
        for (let i = 0; i < lines; i += 1) {
            const r = gap * (i + 2);
            paths.push(`M ${cx2 - r} ${h * 1.05} L ${cx2 - r} ${low} A ${r} ${r} 0 0 1 ${cx2 + r} ${low} L ${cx2 + r} ${h * 1.05}`);
        }
    }
    else if (figure === 1) {
        // Rings from a point off to one side.
        const cx = between(0.55, 1.05) * w;
        const cy = between(-0.1, 1.1) * h;
        const first = between(0.18, 0.45) * h;
        for (let i = 0; i < lines * 2; i += 1) {
            const r = first + gap * 1.6 * i;
            paths.push(`M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`);
        }
    }
    else {
        // A ribbon of lines crossing the paper.
        const a = between(0.1, 0.9) * h;
        const b = between(0.1, 0.9) * h;
        const c = between(0.25, 0.75) * w;
        for (let i = 0; i < lines * 2; i += 1) {
            const d = gap * 1.2 * i;
            paths.push(`M ${-w * 0.05} ${a + d} C ${c} ${a + d}, ${c} ${b + d * 0.4}, ${w * 1.05} ${b + d * 0.4}`);
        }
    }
    return { paths, strokeWidth: Math.max(0.45, h * 0.0028) };
}
/** A steady series of numbers from a text. */
function drawFrom(text) {
    let state = seedOf(text) || 1;
    return (a, b) => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return a + (b - a) * (state / 4294967296);
    };
}
/**
 * The band of fine lines down the card's left (2026-11-06, the owner's second reference), centred on x = 0
 * and never wider than 40 either side. The membership number picks the figure, how many lines, how far
 * apart, where they turn and which way up, so each member's differs:
 *  - two sets of lines, one from each edge of the card, that turn and meet on a centre line;
 *  - or two sets of arches, one hanging from the top, one rising from the bottom, side by side.
 */
function psfCardBand(number, h) {
    const between = drawFrom(`${number}/band`);
    // The first draws of a nearby seed sit close together; spend them.
    for (let i = 0; i < 8; i += 1)
        between(0, 1);
    const flipped = between(0, 1) >= 0.5;
    const mirrored = between(0, 1) >= 0.5;
    const arches = between(0, 1) >= 0.5;
    const y = (v) => (flipped ? h - v : v);
    const x = (v) => (mirrored ? -v : v);
    // A turn drawn mirrored or flipped, but not both, goes the other way round.
    const turn = (sweep) => (flipped === mirrored ? sweep : sweep === 0 ? 1 : 0);
    const paths = [];
    if (arches) {
        const lines = Math.round(between(4, 6));
        const gap = between(3, 3.7);
        const reach = gap * lines;
        const side = 40 - reach;
        const hang = between(0.28, 0.42) * h;
        const rise = hang + reach + between(0.06, 0.16) * h;
        for (let i = 1; i <= lines; i += 1) {
            const r = gap * i;
            paths.push(`M ${x(-side - r)} ${y(-2)} L ${x(-side - r)} ${y(hang)} A ${r} ${r} 0 0 ${turn(0)} ${x(-side + r)} ${y(hang)} L ${x(-side + r)} ${y(-2)}`);
            paths.push(`M ${x(side - r)} ${y(h + 2)} L ${x(side - r)} ${y(rise)} A ${r} ${r} 0 0 ${turn(1)} ${x(side + r)} ${y(rise)} L ${x(side + r)} ${y(h + 2)}`);
        }
    }
    else {
        const lines = Math.round(between(5, 9));
        const gap = Math.min(between(3.2, 5), 40 / lines);
        const meet = between(0.3, 0.5) * h;
        const apart = between(0, 0.05) * h;
        for (let i = 1; i <= lines; i += 1) {
            const r = gap * i;
            // From the top edge, down, turning to end on the centre line.
            paths.push(`M ${x(-r)} ${y(-2)} L ${x(-r)} ${y(meet + apart)} A ${r} ${r} 0 0 ${turn(0)} 0 ${y(meet + apart + r)}`);
            // From the bottom edge, up, turning to end on the centre line, above the other set's ends.
            paths.push(`M ${x(r)} ${y(h + 2)} L ${x(r)} ${y(meet)} A ${r} ${r} 0 0 ${turn(0)} 0 ${y(meet - r)}`);
        }
    }
    return { paths, strokeWidth: 0.85 };
}
/**
 * A honeycomb for the back of the card (the owner's reference), offset by the membership number: an outline
 * for each cell, and a few cells picked out.
 */
function psfCardHoneycomb(number, w, h) {
    const between = drawFrom(`${number}/comb`);
    const r = 15;
    const across = Math.sqrt(3) * r;
    const down = 1.5 * r;
    const startX = between(-across, 0);
    const startY = between(-down, 0);
    const outlines = [];
    const filled = [];
    for (let row = 0; startY + row * down < h + r; row += 1) {
        for (let col = 0; startX + col * across < w + across; col += 1) {
            const cx = startX + col * across + (row % 2 ? across / 2 : 0);
            const cy = startY + row * down;
            const corners = [0, 1, 2, 3, 4, 5].map((k) => {
                const angle = (Math.PI / 180) * (60 * k + 30);
                return `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`;
            });
            const path = `M ${corners.join(" L ")} Z`;
            outlines.push(path);
            if (between(0, 1) < 0.22)
                filled.push(path);
        }
    }
    return { outlines, filled };
}
//# sourceMappingURL=psf-papers.js.map