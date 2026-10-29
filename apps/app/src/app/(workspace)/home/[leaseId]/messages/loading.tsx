import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="messages" rows={6} />
    </PageContent>
  );
}
