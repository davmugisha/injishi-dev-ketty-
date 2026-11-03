import { redirect } from "next/navigation";

/** Old membership-console URL → WorkspaceShell portal. */
export default function Page() {
  redirect("/psf/subtypes");
}
