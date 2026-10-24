import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="units at a glance" count={4} />
      <LoadingBlock shape="table" label="units" rows={6} />
    </PageContent>
  );
}
