import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="earnings" rows={1} />
      <LoadingBlock shape="table" label="earnings" />
    </PageContent>
  );
}
