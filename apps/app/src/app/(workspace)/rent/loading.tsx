import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="rent" rows={1} />
      <LoadingBlock shape="table" label="rent" rows={6} />
    </PageContent>
  );
}
