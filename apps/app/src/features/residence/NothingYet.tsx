import { PageContent, PageHeader } from "@injishi/ui";

/**
 * A residence screen for a business with nothing on it yet (no unit, no lease, no rent row): the screen says so
 * plainly instead of failing on an empty list or borrowing a sample record.
 */
export function ResidenceNothingYet({
  title,
  building,
  message,
}: {
  title: string;
  building: string;
  message: string;
}) {
  return (
    <PageContent>
      <PageHeader eyebrow={building || undefined} title={title} description={message} />
    </PageContent>
  );
}
