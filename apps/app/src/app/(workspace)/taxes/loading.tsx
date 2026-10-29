import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="tax figures" count={4} />
      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingBlock shape="list" label="tax calculation" rows={7} className="lg:col-span-2" />
        <LoadingBlock shape="cards" label="declaration" count={2} />
      </div>
      <LoadingBlock shape="table" label="lease copies for RRA" rows={3} />
    </PageContent>
  );
}
