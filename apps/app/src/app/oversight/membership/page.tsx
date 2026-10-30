import { redirect } from "next/navigation";

import { MEMBERSHIP_CONSOLE_HOME } from "@/pms/oversight/lib/nav";

export default function Page() {
  redirect(MEMBERSHIP_CONSOLE_HOME);
}
