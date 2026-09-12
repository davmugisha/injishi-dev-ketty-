/** Search-param helpers used by the explore filters and the search overlay. */

type ParamValue = string | number | boolean | null | undefined;

/**
 * Build a query string, dropping empty values so a cleared filter leaves no
 * trace in the URL.
 */
export function buildQuery(params: Record<string, ParamValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "" || value === false)
      continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function withQuery(pathname: string, params: Record<string, ParamValue>): string {
  return `${pathname}${buildQuery(params)}`;
}

/** Read a param as a positive integer, falling back when absent or malformed. */
export function readIntParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
