import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="queue counts" />
      <LoadingBlock shape="table" label="businesses" rows={6} />
    </PageContent>
  );
}
