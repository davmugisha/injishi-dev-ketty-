/**
 * One schema.org record, as the `<script type="application/ld+json">` a search
 * engine reads. The records come from `lib/structured-data.ts`.
 *
 * `<` is escaped to `<` so a string in the data (a property description,
 * a guide title) can never close the script element early. The JSON is still
 * the same JSON to a parser; it just cannot be read as HTML.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Not user-supplied HTML: a serialised object with `<` escaped above.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
