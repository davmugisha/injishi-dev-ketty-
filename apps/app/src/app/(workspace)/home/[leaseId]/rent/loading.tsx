import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="your rent at a glance" count={4} />
      <LoadingBlock shape="table" label="charges" rows={3} />
      <LoadingBlock shape="table" label="payments" rows={3} />
    </PageContent>
  );
}
