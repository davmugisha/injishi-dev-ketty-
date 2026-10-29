import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="fault tabs" rows={1} />
      <LoadingBlock shape="table" label="faults" rows={6} />
    </PageContent>
  );
}
