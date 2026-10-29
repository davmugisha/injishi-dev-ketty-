import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AdminHome.pageTitle };

/**
 * Staff land on the registrations: the control tower's figures were sample data, and staff screens show
 * only records from the database.
 */
export default async function AdminHomePage() {
  await requirePersona("AdminHome");
  redirect("/admin/businesses");
}
