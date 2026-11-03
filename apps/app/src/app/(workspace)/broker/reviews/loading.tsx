import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="reviews" rows={1} />
      <LoadingBlock shape="table" label="reviews" />
    </PageContent>
  );
}
