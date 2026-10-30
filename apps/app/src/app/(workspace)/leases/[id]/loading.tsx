import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="the lease" rows={1} />
      <LoadingBlock shape="kpi" label="the lease at a glance" count={4} />
      <div className="grid gap-5 lg:grid-cols-3">
        <LoadingBlock shape="list" label="the terms" rows={5} className="lg:col-span-2" />
        <LoadingBlock shape="list" label="the tenant" rows={2} />
      </div>
    </PageContent>
  );
}
