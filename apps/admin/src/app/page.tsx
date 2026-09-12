import { redirect } from "next/navigation";

/** The control tower opens on the platform overview (F-A02). */
export default function Home() {
  redirect("/overview");
}
