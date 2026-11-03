import type { NextRequest } from "next/server";
import { forwardFile } from "@/server/downloads/forward-file";

/**
 * The local leader's downloads (P5): the guest list as Excel, PDF or CSV, and the report as Excel, PDF or
 * CSV. Each forwards the address's filters, so a file is the view on screen.
 */
const FILES: Record<string, string> = {
  "guests.xlsx": "/api/v1/oversight/guests/export.xlsx",
  "guests.pdf": "/api/v1/oversight/guests/export.pdf",
  "guests.csv": "/api/v1/oversight/guests/export.csv",
  "report.xlsx": "/api/v1/oversight/guests/reports.xlsx",
  "report.csv": "/api/v1/oversight/guests/reports.csv",
  "report.pdf": "/api/v1/oversight/guests/reports.pdf",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const path = FILES[file];
  if (!path) return Response.json({ message: "No such file." }, { status: 404 });
  return forwardFile(request, path, request.nextUrl.searchParams);
}
