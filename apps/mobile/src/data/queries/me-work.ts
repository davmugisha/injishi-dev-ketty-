// The person's own employee files (`GET /me/work`), kept on the phone (mobile spec 0003, D-af).

import { type MyWorkFile, MyWorkFileList } from "@injishi/contracts";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { getParsed } from "../fetch";

export function useMyWorkFiles() {
  const { account } = useSession();
  return useQuery({
    queryKey: ["u", account?.userId, "me-work"],
    queryFn: () => getParsed(MyWorkFileList, "/api/v1/me/work"),
    enabled: !!account,
    meta: { persist: true },
  });
}

/**
 * The employee file the shift card punches on (D-af): the one whose org is the housekeeping
 * workspace's and that is active. `undefined` while it is not known yet; `null` when there is none,
 * so clock in is not set up here.
 */
export function useEmployeeFile(): { file: MyWorkFile | null | undefined; query: ReturnType<typeof useMyWorkFiles> } {
  const { account } = useSession();
  const query = useMyWorkFiles();
  const orgId = account?.workspace?.orgId;
  if (!query.data) return { file: undefined, query };
  const file = orgId ? query.data.files.find((f) => f.orgId === orgId && f.status === "active") : undefined;
  return { file: file ?? null, query };
}
