import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="guest counts" />
      <LoadingBlock shape="table" label="guests" rows={6} />
    </PageContent>
  );
}
