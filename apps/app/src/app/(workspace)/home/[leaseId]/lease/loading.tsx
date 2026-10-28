import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="your lease" rows={1} />
      <div className="grid gap-5 lg:grid-cols-3">
        <LoadingBlock shape="list" label="the contract" rows={6} className="lg:col-span-2" />
        <LoadingBlock shape="list" label="the signatures" rows={3} />
      </div>
    </PageContent>
  );
}
