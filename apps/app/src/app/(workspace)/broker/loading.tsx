import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="your home" rows={1} />
      <LoadingBlock shape="kpi" label="your work" count={4} />
      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingBlock shape="chart" label="fees" className="lg:col-span-2" />
        <LoadingBlock shape="list" label="your plan" rows={3} />
      </div>
    </PageContent>
  );
}
