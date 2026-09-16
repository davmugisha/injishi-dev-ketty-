import { redirect } from "next/navigation";

/**
 * Services · departments — the address Departments used to live at (ADR-055).
 *
 * **The page is gone and the ROUTE stays**, which is the whole point. A lens is
 * a route segment precisely so one person can send another a link to it
 * (ADR-018, D-c), and links that were already sent do not un-send themselves.
 * Deleting the folder would have turned every one of them into the workspace
 * home, silently.
 *
 * A server side `redirect` rather than a client one: it answers 307 before any
 * JavaScript loads, so a shared link lands on the screen rather than flashing an
 * empty Services rail on the way. The workspace id is carried through, because
 * every operator route lives inside the workspace it acts on (ADR-018, AC-1) and
 * a redirect that dropped it would land on somebody else's idea of "the" hotel.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}/people/departments`);
}
