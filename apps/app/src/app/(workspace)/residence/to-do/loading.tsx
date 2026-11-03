import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="what needs doing" rows={1} />
      <LoadingBlock shape="table" label="what needs doing" rows={6} />
    </PageContent>
  );
}
