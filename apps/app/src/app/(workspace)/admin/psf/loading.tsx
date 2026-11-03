import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="cards" label="memberships" />
      <LoadingBlock shape="table" label="businesses" rows={6} />
    </PageContent>
  );
}
