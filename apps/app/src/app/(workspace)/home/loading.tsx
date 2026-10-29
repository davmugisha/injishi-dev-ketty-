import { LoadingBlock, PageContent } from "@injishi/ui";

export default function Loading() {
  return (
    <PageContent>
      <LoadingBlock shape="cards" label="your homes" count={2} />
    </PageContent>
  );
}
