import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="list" label="lease copies" rows={1} />
      <LoadingBlock shape="table" label="lease copies" rows={6} />
    </PageContent>
  );
}
