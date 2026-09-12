/**
 * The string walker the three ADR-027 vocabulary rules share, and the one
 * exemption list they share with it.
 *
 * WHY A SHARED WALKER AT ALL. ADR-027 section 8 states the requirement and the
 * reason in one breath: *"All three walk every string in the file, meaning
 * every `Literal` and every `TemplateElement` node, not only a JSX `className`
 * attribute."* The codebase does not put classes in a plain attribute.
 * `stays-for-every-trip.tsx` builds them in a ternary, `pipeline-status.tsx`
 * keeps them in an object literal class map, `filter-primitives.tsx` passes
 * several arguments to `cn()`, and template literals appear throughout. A rule
 * scoped to `className` attributes would pass a file that is full of
 * violations — *"which is worse than no rule, because it reads as green."*
 *
 * That sentence is the reason this file exists rather than three copies of the
 * same visitor: three copies drift, and the one that drifts is the one that
 * quietly stops looking inside `cn()`.
 *
 * THE COST, STATED. Walking every string means the rules also read strings that
 * are not class lists — a URL, a test id, a sentence of prose. In practice the
 * patterns are specific enough that this does not produce noise: no English
 * sentence contains `text-[13px]`. Where it could, the exemptions below carry
 * it, and `ADR-027` names them as the only ones.
 */

import { basename } from 'node:path';

/**
 * Files the vocabulary rules do not read. ADR-027, Exceptions.
 *
 * Two entries, each a category rather than a convenience:
 *
 * 1. **`marks.tsx` — brand marks whose colour is owned by someone else.** The
 *    payment and provider logos keep their exact hex values. *"Visa blue is
 *    Visa's fact, not the theme's."* A theme that recolours a Visa mark is a
 *    theme that has made a legal claim it cannot support.
 *
 * 2. **`footer-glass.tsx` — a value a token cannot reach.** The fluted-glass
 *    shader parses colour strings itself, so `var(--white)` is not a value it
 *    can read and a token reference cannot be passed through. Its two literals
 *    mirror the FIXED `--white` and `--black`, which ADR-010 pinned to one
 *    value in both themes, so they cannot drift from the palette; and they are
 *    specular light and shade rather than brand colour. ADR-023 records it.
 *    This is a technical constraint, not a preference — which is the only kind
 *    of reason that belongs on this list.
 *
 * The other two ADR-027 exceptions — reading measures and relationship widths —
 * are NOT path exemptions. They are shapes, and each rule recognises its own,
 * so that `max-w-prose` stays legal in every file rather than in a listed one.
 *
 * Kept as basenames rather than paths so the list survives a directory move.
 * A file added here needs a sentence in this comment saying whose fact the
 * colour is, or why a token cannot reach it; an entry without one is a rule
 * being turned off.
 */
export const EXEMPT_BASENAMES = new Set(['marks.tsx', 'footer-glass.tsx']);

/** True when this file is outside the vocabulary rules' reach. */
export function isExemptFile(context) {
  const filename = context.filename ?? context.getFilename?.();
  if (!filename) return false;
  return EXEMPT_BASENAMES.has(basename(filename));
}

/**
 * Visit every string the file contains: string literals and the static halves
 * of template literals.
 *
 * `TemplateElement` is the second half of the requirement and the half that is
 * easy to forget. In `` `rounded-card ${tone} text-[13px]` `` the offending
 * class lives in a `TemplateElement`, not in a `Literal`, so a rule that
 * visited only `Literal` would pass that line.
 *
 * Regex literals are deliberately skipped: a rule's own source is full of
 * strings that look like violations, and a pattern is a description of a class
 * rather than a use of one.
 *
 * @param {(value: string, node: import('estree').Node) => void} report
 * @returns {import('eslint').Rule.RuleListener}
 */
export function walkStrings(report) {
  return {
    Literal(node) {
      if (typeof node.value === 'string') report(node.value, node);
    },
    TemplateElement(node) {
      const raw = node.value?.cooked ?? node.value?.raw;
      if (typeof raw === 'string' && raw.length > 0) report(raw, node);
    },
  };
}

/**
 * Split a class-list-shaped string into candidate class tokens.
 *
 * Whitespace only. A Tailwind class may contain almost anything else —
 * `hover:`, `md:`, `[&_[data-dot]]:`, `bg-white/90` — and every one of those is
 * part of the token the rules need to see.
 */
export function tokens(value) {
  return value.split(/\s+/).filter(Boolean);
}

/**
 * Strip the variant chain from a class token and return both halves.
 *
 * `md:hover:bg-ink` -> `{ variants: ['md', 'hover'], base: 'bg-ink' }`
 *
 * Splitting on `:` naively would cut an arbitrary value containing a colon
 * (`bg-[url(https://…)]`), so bracketed and parenthesised spans are skipped.
 * ADR-028 depends on this being right in both directions: it must see that
 * `md:bg-ink` carries a variant, and it must not mistake the `:` inside
 * `[&:hover]` for one.
 */
export function splitVariants(token) {
  const variants = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i];
    if (ch === '[' || ch === '(') depth += 1;
    else if (ch === ']' || ch === ')') depth -= 1;
    else if (ch === ':' && depth === 0) {
      variants.push(token.slice(start, i));
      start = i + 1;
    }
  }
  return { variants, base: token.slice(start) };
}

/**
 * Drop an opacity modifier: `bg-white/90` -> `bg-white`.
 *
 * The slash is not part of the role name, and a rule that kept it would fail to
 * recognise `bg-white/90` as the fixed ground it is. Bracketed spans are
 * skipped for the same reason as above.
 */
export function stripOpacity(base) {
  let depth = 0;
  for (let i = 0; i < base.length; i += 1) {
    const ch = base[i];
    if (ch === '[' || ch === '(') depth += 1;
    else if (ch === ']' || ch === ')') depth -= 1;
    else if (ch === '/' && depth === 0) return base.slice(0, i);
  }
  return base;
}

/**
 * A cheap gate: does this string plausibly hold Tailwind classes at all?
 *
 * Used only to skip obvious prose before the per-token work. It is deliberately
 * generous — a false positive here costs a few regex tests, and a false
 * negative silently disables the rule for that string.
 */
export function looksLikeClasses(value) {
  return value.length > 0 && value.length < 4000 && !value.includes('\n\n');
}
