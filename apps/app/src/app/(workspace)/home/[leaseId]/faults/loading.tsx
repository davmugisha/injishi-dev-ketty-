import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="table" label="faults" rows={4} />
    </PageContent>
  );
}
