import { describe, expect, test } from "vitest";

import { FOOTER_COLUMNS, headerVariantFor } from "@/data/navigation";

describe("the app downloads page in the site's navigation (mobile spec 0004)", () => {
  test("the footer's Company column has a Get the app link to /downloads (AC-10)", () => {
    const company = FOOTER_COLUMNS.find((column) => column.title === "Company");

    expect(company?.links).toContainEqual(expect.objectContaining({ label: "Get the app", href: "/downloads" }));
  });

  test("the link appears once in the footer, not in two columns", () => {
    const all = FOOTER_COLUMNS.flatMap((column) => column.links).filter((link) => link.href === "/downloads");

    expect(all).toHaveLength(1);
  });

  test("/downloads wears the white header, since it opens on a white ground and not a photograph", () => {
    expect(headerVariantFor("/downloads")).toBe("white");
  });
});
