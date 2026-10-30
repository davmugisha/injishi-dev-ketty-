import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="the page" rows={1} />
      <LoadingBlock shape="table" label="your charges" rows={6} />
    </PageContent>
  );
}
