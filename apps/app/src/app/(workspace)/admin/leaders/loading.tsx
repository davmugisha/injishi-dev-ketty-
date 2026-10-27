import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="table" label="appointments" rows={6} />
    </PageContent>
  );
}
