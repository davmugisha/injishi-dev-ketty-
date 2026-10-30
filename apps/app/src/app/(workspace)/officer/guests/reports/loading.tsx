import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="report figures" />
      <LoadingBlock shape="chart" label="arrivals" />
      <LoadingBlock shape="table" label="guests by area" rows={4} />
    </PageContent>
  );
}
