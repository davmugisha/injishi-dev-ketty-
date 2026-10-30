/**
 * The property setup page's address, `/w/<workspaceId>/setup`.
 *
 * It is not a board in the screen registry: it belongs to one business, not to a persona, and the web's
 * "Set up your property" button links straight to it (web forwards `/w/*` to this app). Sign-in normally
 * returns only to a registered screen; this one pattern is allowed too, matched exactly, because the page
 * itself refuses a workspace that is not the signed-in person's.
 */
const SETUP = /^\/w\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/setup$/i;

export function setupPath(workspaceId: string): string {
  return `/w/${workspaceId}/setup`;
}

/** True for `/w/<uuid>/setup` (query string ignored), and nothing else. */
export function isSetupPath(path: string): boolean {
  return SETUP.test(path.split("?")[0] ?? "");
}
