import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="your decisions" rows={1} />
      <LoadingBlock shape="table" label="your decisions" rows={6} />
    </PageContent>
  );
}
