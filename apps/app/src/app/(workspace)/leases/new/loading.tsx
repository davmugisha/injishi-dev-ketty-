import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="the new lease steps" rows={1} />
      <div className="grid gap-5 lg:grid-cols-3">
        <LoadingBlock shape="list" label="the new lease form" rows={4} className="lg:col-span-2" />
        <LoadingBlock shape="list" label="the lease so far" rows={2} />
      </div>
    </PageContent>
  );
}
