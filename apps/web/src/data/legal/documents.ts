import type { Metadata } from "next";

import { COOKIES } from "@/data/legal/cookies";
import { PRIVACY } from "@/data/legal/privacy";
import { TERMS } from "@/data/legal/terms";
import type { LegalContent } from "@/data/legal/types";

/** The three legal documents and their addresses. */
export const LEGAL_DOCUMENTS: readonly { path: string; content: LegalContent }[] = [
  { path: "/legal/terms", content: TERMS },
  { path: "/legal/privacy", content: PRIVACY },
  { path: "/legal/cookies", content: COOKIES },
];

/**
 * A draft is readable but not indexed: it carries `[TO CONFIRM]` markers and
 * a notice saying it may change, and a search result quoting a sentence a
 * lawyer has not yet read is worse than no result. Flipping a document to
 * `final` lifts this and puts it in the sitemap, with no other change.
 */
export function legalRobots(content: LegalContent): Metadata["robots"] {
  return content.status === "draft" ? { index: false, follow: true } : undefined;
}
