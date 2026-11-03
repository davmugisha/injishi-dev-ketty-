import { redirect } from "next/navigation";

/** Old membership-console URL → WorkspaceShell portal. */
export default async function Page({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  redirect(`/psf/${applicationId}`);
}
