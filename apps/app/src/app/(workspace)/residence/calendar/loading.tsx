import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="the calendar" rows={1} />
      <LoadingBlock shape="table" label="the calendar" rows={6} />
    </PageContent>
  );
}
