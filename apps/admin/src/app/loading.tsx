import { Skeleton } from "@injishi/ui";

/**
 * What a staff screen shows while the server is reading it.
 *
 * THERE WAS NOTHING HERE. Every read in this console happens on the server
 * during the render and is allowed up to ten seconds (`lib/api/server.ts`), so
 * a staffer pressing a nav row got the previous screen, frozen, for as long as
 * the API took — which reads as a console that has stopped responding. Next
 * renders this file in the shell's `<main>` while the page's own reads are out,
 * so the chrome stays put and only the panel is standing in.
 *
 * It is the SHAPE of a section rather than a spinner: the eyebrow, the hero
 * card, a stat row and the first rows of a table, in the same geometry the real
 * screens use, so nothing jumps when the answer lands. The shimmer is the
 * package `Skeleton`'s — "this is arriving", where a pulse reads as broken.
 *
 * The sentence is for a screen reader, which sees no shimmer. Present tense and
 * plain: the person knows what is happening, not that a state machine changed.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6" aria-busy>
      <p className="sr-only" role="status">
        Getting this section ready
      </p>

      <section className="rounded-card border border-border bg-field p-6 sm:p-7">
        <Skeleton className="h-3 w-24" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="size-12 rounded-card" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="mt-4 h-3 w-full max-w-read" />
        <Skeleton className="mt-2 h-3 w-3/4 max-w-read" />
      </section>

      <dl className="mt-6 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-16" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </dl>

      <div className="mt-8">
        <Skeleton className="h-3 w-40" />
        <div className="mt-3 divide-y divide-border rounded-card border border-border bg-field">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-card" />
              <div className="min-w-0 grow">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
