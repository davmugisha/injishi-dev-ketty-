import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="the page" rows={1} />
      <LoadingBlock shape="table" label="your calendar" rows={6} />
    </PageContent>
  );
}
