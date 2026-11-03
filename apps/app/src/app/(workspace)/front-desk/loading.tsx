import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="the front desk" rows={1} />
      <LoadingBlock shape="table" label="the front desk" rows={6} />
    </PageContent>
  );
}
