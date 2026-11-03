import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="your queues" rows={1} />
      <LoadingBlock shape="table" label="businesses" rows={6} />
    </PageContent>
  );
}
