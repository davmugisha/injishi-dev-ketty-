import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PHOTO_CREDITS } from "@/data/generated/photo-credits";

export const metadata: Metadata = {
  title: "Photo credits",
  description:
    "Every photograph on Injishi, with its photographer, licence and source.",
};

/**
 * Photo credits.
 *
 * Most of the photography here is CC BY or CC BY-SA, which requires the
 * author and licence to travel with the work. The list is generated from the
 * image manifest, so a photograph cannot reach the site without reaching this
 * page — which is the point: an uncredited CC BY image is a licence breach,
 * not a missing nicety.
 */
export default function Page() {
  const attributed = PHOTO_CREDITS.filter((credit) => credit.attributionRequired);

  return (
    <div className="page-y">
      <div className="container flex flex-col">
        <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "Photo credits" }]} />

        <div className="flex flex-col gap-4 py-10">
          <h1 className="text-3xl text-page-fg lg:text-display-md">Photo credits</h1>
          <p className="max-w-read text-page-fg-70">
            Injishi does not yet hold its own photography of the stays it lists. Until it
            does, the site uses freely licensed photographs of the places these stays sit
            in, from Wikimedia Commons. {attributed.length} of the {PHOTO_CREDITS.length}{" "}
            require attribution, and all {PHOTO_CREDITS.length} are listed below.
          </p>
          <p className="max-w-read text-sm text-page-fg-70">
            Photographs of a property itself are marked as such. Everything else shows the
            city, park or lakeshore around the stay, not the stay.
          </p>
        </div>

        <div className="scrollbar overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-input">
                <th className="py-3 pr-6 font-medium text-page-fg-70">Subject</th>
                <th className="py-3 pr-6 font-medium text-page-fg-70">Photographer</th>
                <th className="py-3 pr-6 font-medium text-page-fg-70">Licence</th>
                <th className="py-3 font-medium text-page-fg-70">Source</th>
              </tr>
            </thead>
            <tbody>
              {PHOTO_CREDITS.map((credit) => (
                <tr key={credit.stem} className="border-b border-input/60 align-top">
                  <td className="py-3 pr-6 text-page-fg">{credit.subject}</td>
                  <td className="py-3 pr-6 text-page-fg-70">{credit.author}</td>
                  <td className="py-3 pr-6 text-page-fg-70">{credit.licence}</td>
                  <td className="py-3">
                    <a
                      href={credit.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-text underline underline-offset-2 hover:opacity-80"
                    >
                      Wikimedia Commons
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
