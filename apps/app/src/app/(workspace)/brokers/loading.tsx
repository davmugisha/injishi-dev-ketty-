import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="kpi" label="broker figures" count={3} />
      <LoadingBlock shape="table" label="placements" rows={5} />
    </PageContent>
  );
}
