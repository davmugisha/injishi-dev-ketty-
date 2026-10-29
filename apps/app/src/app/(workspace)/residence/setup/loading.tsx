import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="setup" rows={5} />
    </PageContent>
  );
}
