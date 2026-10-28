import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="lease tabs" rows={1} />
      <LoadingBlock shape="table" label="leases" rows={6} />
    </PageContent>
  );
}
