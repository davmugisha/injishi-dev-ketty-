import type { Metadata } from "next";

import { PsfRegister } from "@/components/psf/register/psf-register";

export const metadata: Metadata = {
  title: "Register for PSF",
  description: "Register any business for the Private Sector Federation in one form, with no account. Get a docID to follow your application.",
};

/** The public PSF form (2026-10-19): one form, four steps, no account. */
export default function PsfRegisterPage() {
  return <PsfRegister />;
}
