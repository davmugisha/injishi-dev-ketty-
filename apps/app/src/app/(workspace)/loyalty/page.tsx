import { screens } from "@injishi/data";
import type {
  LoyaltyCandidate,
  LoyaltyLiability,
  LoyaltyMember,
  LoyaltyProgramme,
  LoyaltyTier,
  LoyaltyTransaction,
} from "@injishi/data/fixtures/operations";
import { LoyaltyView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.Loyalty.pageTitle };

export default async function LoyaltyPage() {
  const persona = await requirePersona("Loyalty");
  const [programme, tiers, members, candidates, transactions, liability] = await Promise.all([
    getDocument<LoyaltyProgramme>("operations.loyaltyProgramme", "amahoro-circle"),
    getCollection<LoyaltyTier>("operations.loyaltyTiers"),
    getCollection<LoyaltyMember>("operations.loyaltyMembers"),
    getCollection<LoyaltyCandidate>("operations.loyaltyCandidates"),
    getCollection<LoyaltyTransaction>("operations.loyaltyTransactions"),
    getCollection<LoyaltyLiability>("operations.loyaltyLiability"),
  ]);
  if (!programme) notFound();
  return (
    <PmsMount>
      <LoyaltyView persona={persona} data={{ programme, tiers, members, candidates, transactions, liability }} />
    </PmsMount>
  );
}
