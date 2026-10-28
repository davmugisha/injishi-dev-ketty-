import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="expense figures" count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <LoadingBlock shape="chart" label="expenses by month" />
        <LoadingBlock shape="chart" label="expenses by category" />
      </div>
      <LoadingBlock shape="table" label="expenses" rows={6} />
    </PageContent>
  );
}
