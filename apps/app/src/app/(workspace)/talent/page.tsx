import { screens } from "@injishi/data";
import type { Employee, PeopleProperty } from "@injishi/data/fixtures/people";
import { TalentView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";
import { readOnboarding, readReviewCycle, readTalentBoard } from "@/server/talent";

export const metadata: Metadata = { title: screens.Talent.pageTitle };

/** People › Talent: vacancies and their candidates, interviews, new starters' joining lists and reviews. */
export default async function TalentPage() {
  await requirePersona("Talent");
  const ctx = await requestContext();
  const [board, cycle, onboarding, branches, employees] = await Promise.all([
    readTalentBoard(ctx),
    readReviewCycle(ctx),
    readOnboarding(ctx),
    getCollection<PeopleProperty>("people.properties"),
    getCollection<Employee>("people.employees"),
  ]);
  return (
    <HrMount off={await hrFeaturesOff()}>
      <TalentView
        board={board}
        cycle={cycle}
        onboarding={onboarding}
        branches={branches.map((b) => ({ id: String(b.id), name: b.name }))}
        people={employees
          .filter((e) => e.status !== "leaving")
          .map((e) => ({ id: e.id, name: e.name, title: e.position }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        today={ctx.today.iso}
      />
    </HrMount>
  );
}
