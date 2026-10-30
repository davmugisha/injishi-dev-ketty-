import { LoadingBlock } from "@injishi/ui";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16">
      <LoadingBlock shape="list" label="your invitation" rows={3} />
    </main>
  );
}
