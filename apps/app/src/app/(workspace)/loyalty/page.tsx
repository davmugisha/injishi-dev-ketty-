import { screens } from "@injishi/data";
import type {
  LoyaltyCandidate,
  LoyaltyLiability,
  LoyaltyMember,
  LoyaltyProgramme,
  LoyaltyTier,
  LoyaltyTransaction,
} from "@injishi/data/fixtures/operations";
import { getCollection, getDocument } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoyaltyView } from "@/features/operations/LoyaltyView";
import { requirePersona } from "@/lib/session";

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
  return <LoyaltyView persona={persona} data={{ programme, tiers, members, candidates, transactions, liability }} />;
}
