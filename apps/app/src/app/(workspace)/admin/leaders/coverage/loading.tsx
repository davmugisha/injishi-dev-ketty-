import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="coverage figures" />
      <LoadingBlock shape="table" label="areas with no leader" rows={5} />
    </PageContent>
  );
}
