import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@injishi/web-ui";
import { Checkout } from "@/components/book/checkout";

export const metadata: Metadata = {
  title: "Confirm and pay",
  robots: { index: false },
};

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-page px-5 py-10">
          <Skeleton className="h-[640px] w-full rounded-card" />
        </div>
      }
    >
      <Checkout />
    </Suspense>
  );
}
