import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="moving out steps" rows={1} />
      <LoadingBlock shape="cards" label="notice and deposit" count={2} />
    </PageContent>
  );
}
