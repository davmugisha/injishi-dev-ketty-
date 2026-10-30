import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="placements" rows={1} />
      <LoadingBlock shape="table" label="placements" />
    </PageContent>
  );
}
