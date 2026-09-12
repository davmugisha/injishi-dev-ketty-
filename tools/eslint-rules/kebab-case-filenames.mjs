/**
 * `injishi/kebab-case-filenames` — every source file is named in kebab-case.
 *
 * The repo used to hold two conventions at once: 109 PascalCase files
 * (`AppShell.tsx`, `RentRoll.tsx`) against roughly as many kebab-case ones
 * (`site-header.tsx`), and `components/ui/` was PascalCase in admin and
 * kebab-case in web. `code-standards.md` said PascalCase, the donor tree being
 * drained into `apps/web` said kebab, and nothing enforced either — so the
 * answer to "what do I call this file?" was "look at the file next to it", and
 * the file next to it disagreed.
 *
 * Kebab won because it is what every non-component file already used
 * (`sw-cache-policy.ts`, `front-desk.reducer.ts`), what the Nest service uses
 * (`workspace.guard.ts`), and what the donor tree keeps sending in. Choosing
 * PascalCase would have meant renaming those too, and renaming every donor file
 * again on the way in.
 *
 * A case-only difference is invisible on Windows and macOS and fatal on Linux
 * CI, so this is not only tidiness: `AppShell.tsx` imported as `./app-shell`
 * resolves locally and 404s in a container.
 *
 * Dotted qualifiers are part of the name and are checked too, so
 * `front-desk.reducer.ts` passes and `frontDesk.Reducer.ts` does not. A leading
 * underscore is allowed because Next reserves it for private files, and a
 * leading `+` because Expo Router reserves it for its own routes
 * (`+not-found`, `+html`, `+native-intent`).
 */

/** kebab-case: lowercase words and digits, joined by single hyphens. */
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `AppShell` -> `app-shell`, `RoomsRates` -> `rooms-rates`. */
function toKebab(segment) {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require kebab-case source filenames, so one convention answers "what do I call this file?" and a case-only rename cannot pass locally and fail on Linux CI.',
    },
    schema: [],
    messages: {
      notKebab:
        'Rename `{{actual}}` to `{{suggested}}`. This repo names every source file in kebab-case (code-standards.md, Naming). Two conventions at once means a case-only import difference resolves on Windows and 404s on Linux CI.',
    },
  },

  create(context) {
    return {
      Program(node) {
        const filename = context.filename ?? context.getFilename();
        if (!filename || filename === '<input>' || filename === '<text>') return;

        const base = filename.split(/[\\/]/).pop();
        // A leading `_` is Next's private marker and a leading `+` is Expo
        // Router's reserved-route marker. Neither is part of a name anyone
        // chose, and both are names the framework stops resolving if they are
        // changed — the same reasoning as the bracket exemption below.
        // Without the `+`, `app/+not-found.tsx` reported a rename to
        // `+not-found.tsx`: the rule had no complaint about the name, only
        // about the sigil.
        const leading = base.startsWith('_') || base.startsWith('+') ? base[0] : '';
        const parts = (leading ? base.slice(1) : base).split('.');

        // A bracketed segment is a router parameter, not a name anyone chose:
        // `[id].tsx`, `[...rest].tsx`, `[[...rest]].tsx`. Next puts these in
        // DIRECTORY names, which this rule never sees, so the exemption was not
        // needed while only web and pms were linted. Expo Router puts them in
        // the FILE name, so without this the rule would report every dynamic
        // route in `apps/mobile` and demand a rename the framework would then
        // stop resolving. Same reasoning as the leading underscore above: the
        // framework owns the name, so the convention does not apply to it. The
        // parameter inside the brackets is a JS identifier at the call site
        // (`useLocalSearchParams().threadId`), so it is left camelCase.
        if (parts.every((p) => SEGMENT.test(p) || /^\[+\.{0,3}[A-Za-z0-9_]+\]+$/.test(p))) return;

        context.report({
          node,
          messageId: 'notKebab',
          data: {
            actual: base,
            suggested: leading + parts.map(toKebab).join('.'),
          },
        });
      },
    };
  },
};

export default rule;
