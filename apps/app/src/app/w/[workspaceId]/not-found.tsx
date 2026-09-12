import NotFound from "@/app/not-found";

/**
 * The refusal for a workspace id this caller does not hold (ADR-017, D-c).
 *
 * The same page as the app-wide one, mounted here so the boundary that catches
 * `notFound()` sits directly above the layout that throws it rather than at the
 * root. Same wording on purpose: "not yours" and "not real" must read alike, or
 * the difference tells a stranger which ids exist.
 */
export default NotFound;
