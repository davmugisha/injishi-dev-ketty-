import { currentSessionCookie } from "@/lib/session";
import { apiBaseUrl, apiOrigin } from "@/server/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A person's own payslip as a PDF, from Me. The API's route is session guarded and answers for the
 * caller's own file only (any other is 404), so this hands the browser the file the API drew,
 * carrying the session the app keeps for the person. The session cookie never reaches the browser.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const cookie = await currentSessionCookie();
  if (!cookie) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  const employeeId = new URL(request.url).searchParams.get("file") ?? "";
  if (!UUID.test(id) || !UUID.test(employeeId)) return new Response("No such payslip.", { status: 404 });
  const res = await fetch(`${apiBaseUrl()}/api/v1/me/work/${employeeId}/payslips/${id}/pdf`, {
    headers: { cookie, origin: apiOrigin() },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok)
    return new Response(res.status === 404 ? "No such payslip." : "The payslip could not be drawn.", {
      status: res.status,
    });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/pdf",
      "content-disposition": res.headers.get("content-disposition") ?? 'attachment; filename="payslip.pdf"',
      "cache-control": "no-store",
    },
  });
}
