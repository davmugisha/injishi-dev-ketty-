import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="filters" rows={1} />
      <div className="grid gap-4 lg:grid-cols-5">
        <LoadingBlock shape="cards" label="homes" count={4} className="lg:col-span-3" />
        <LoadingBlock shape="chart" label="map" className="lg:col-span-2" />
      </div>
    </PageContent>
  );
}
