import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="your home" rows={1} />
      <LoadingBlock shape="kpi" label="this month's figures" count={6} />
      <div className="grid gap-5 lg:grid-cols-3">
        <LoadingBlock shape="chart" label="rent collected" className="lg:col-span-2" />
        <LoadingBlock shape="list" label="what needs attention" rows={3} />
      </div>
    </PageContent>
  );
}
