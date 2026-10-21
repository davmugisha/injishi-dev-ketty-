/**
 * The shape the three legal documents are written in (terms, privacy, cookies).
 *
 * CONTENT IS DATA, ONE RENDERER. Each document is a typed object in this folder
 * and `components/legal/legal-document.tsx` is the only thing that draws one, so
 * the three pages cannot drift apart in layout, anchors or the draft notice. A
 * lawyer's edit is an edit to a string here and touches no markup.
 *
 * THREE INLINE FORMS, parsed by the renderer from any string below:
 *
 *   [TO CONFIRM: what is needed]   a fact only the owner or the lawyer can
 *                                  supply. Drawn highlighted, and counted in the
 *                                  draft notice, so a reviewer can scan for them.
 *                                  It may not contain a closing bracket.
 *   [label](/href)                 a link: a site path, a `#section` on the same
 *                                  page, or a `mailto:` address.
 *   `name`                         a literal, such as a cookie name.
 *
 * A document is `final` only once every marker is gone and the lawyer has
 * signed it off. Until then it stays `draft`, and the page says so at the top.
 */

export type LegalStatus = "draft" | "final";

/** A bulleted list. Each item is one string, with the inline forms above. */
export interface LegalList {
  list: readonly string[];
}

/** A small table, such as the cookie list. Every cell takes the inline forms. */
export interface LegalTable {
  table: {
    columns: readonly string[];
    rows: readonly (readonly string[])[];
  };
}

/** A plain string is a paragraph. */
export type LegalBlock = string | LegalList | LegalTable;

export interface LegalSection {
  /**
   * The anchor, as in `/legal/terms#cancellation`. Kebab case, unique within
   * its document, and stable once anything links to it: the checkout links
   * straight to `#cancellation`.
   */
  id: string;
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalContent {
  /** The page title, the same words as the page's metadata title. */
  title: string;
  /** One or two sentences under the title. */
  summary: string;
  status: LegalStatus;
  /** `yyyy-mm-dd`. The date of the last change to the words, not the deploy. */
  lastUpdated: string;
  sections: readonly LegalSection[];
}
