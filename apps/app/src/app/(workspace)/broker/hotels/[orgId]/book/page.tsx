import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { BookRoomsView } from "@/features/broker/book-rooms-view";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerDeals, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: "Book rooms" };

/** Book rooms at a hotel under the broker's running deal with it (0125). */
export default async function BookRoomsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  await requirePersona("BrokerHotels");
  if (!(await brokerScope())) return <NotABroker title="Book rooms" />;
  const deal = (await brokerDeals()).deals.find((d) => d.hotel.orgId === orgId && d.status === "active");
  if (!deal) {
    return (
      <PageContent>
        <PageHeader title="Book rooms" />
        <EmptyBlock
          icon="Briefcase"
          title="No running deal with this hotel"
          description="You book a hotel's rooms once it has accepted your deal. Propose one on Hotels."
        />
      </PageContent>
    );
  }
  return <BookRoomsView deal={deal} />;
}

export const dynamic = "force-dynamic";
