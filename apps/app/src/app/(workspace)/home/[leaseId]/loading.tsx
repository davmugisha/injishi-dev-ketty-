import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="your home" rows={1} />
      <LoadingBlock shape="kpi" label="your figures" count={4} />
      <div className="grid gap-5 lg:grid-cols-3">
        <LoadingBlock shape="chart" label="your payments" className="lg:col-span-2" />
        <LoadingBlock shape="list" label="your landlord" rows={2} />
      </div>
    </PageContent>
  );
}
