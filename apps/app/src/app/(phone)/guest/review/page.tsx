import { screens } from "@injishi/data";
import type { GuestReviewRecord, GuestRewards, ReviewPhoto } from "@injishi/data/fixtures/guest";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestReviewView } from "@/features/guest/GuestReviewView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.GuestReview.pageTitle };

export default async function GuestReviewPage({ searchParams }: { searchParams: Promise<{ hotelSide?: string }> }) {
  const persona = await requirePersona("GuestReview");
  const [reviews, roll, rewards] = await Promise.all([
    getCollection<GuestReviewRecord>("guest.reviews"),
    getCollection<ReviewPhoto>("guest.reviewPhotoRoll"),
    getCollection<GuestRewards>("guest.rewards"),
  ]);
  const review = reviews[0];
  const reward = rewards[0];
  if (!review || !reward) notFound();
  const { hotelSide } = await searchParams;
  return (
    <GuestReviewView
      data={{ review, roll, rewards: reward }}
      hotelSide={hotelSide === "submitted" ? "submitted" : "not yet"}
      firstName={persona.firstName}
    />
  );
}
