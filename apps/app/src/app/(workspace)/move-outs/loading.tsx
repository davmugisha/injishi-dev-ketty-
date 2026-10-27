import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="move-out tabs" rows={1} />
      <LoadingBlock shape="table" label="move-outs" rows={6} />
    </PageContent>
  );
}
