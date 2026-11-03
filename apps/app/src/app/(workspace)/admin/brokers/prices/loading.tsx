import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="cards" label="plans" />
      <LoadingBlock shape="table" label="subscriptions" rows={5} />
    </PageContent>
  );
}
