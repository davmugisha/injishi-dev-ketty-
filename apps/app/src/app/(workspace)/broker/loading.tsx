import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="your work" count={4} />
      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingBlock shape="cards" label="newest homes" count={4} className="lg:col-span-2" />
        <LoadingBlock shape="list" label="placements" rows={5} />
      </div>
    </PageContent>
  );
}
