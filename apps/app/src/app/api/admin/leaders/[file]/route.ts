import type { NextRequest } from "next/server";
import { forwardFile } from "@/server/downloads/forward-file";

/** Admin's coverage report as CSV (P5). */
const FILES: Record<string, string> = {
  "coverage.csv": "/api/v1/admin/local-leaders/coverage.csv",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const path = FILES[file];
  if (!path) return Response.json({ message: "No such file." }, { status: 404 });
  return forwardFile(request, path, new URLSearchParams());
}
