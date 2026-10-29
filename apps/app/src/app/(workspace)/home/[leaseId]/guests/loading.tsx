import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="guest tabs" rows={1} />
      <LoadingBlock shape="table" label="guests" rows={4} />
    </PageContent>
  );
}
