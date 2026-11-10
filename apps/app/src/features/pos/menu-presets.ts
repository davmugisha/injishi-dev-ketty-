/**
 * What a new menu section starts with. A product only sells once it carries the RRA codes a receipt needs
 * (classification, type, packaging and quantity units), and a new product copies them from its menu section, so
 * a section is created with a sensible set instead of an owner having to know four codes.
 *
 * These are the SAME codes the demo menu already uses: drinks and food share a tax rate (TAX_B, 18% VAT), water
 * is VAT-exempt (TAX_A) and is set per product, and a service is item type 3. They are starting points, not
 * advice: the classification can be refined on the catalogue, and nothing here is submitted to RRA.
 */
export type SectionKind = "drinks" | "food" | "service";

export const SECTION_PRESETS: Record<
  SectionKind,
  { label: string; hint: string; cls: string; ty: string; pkg: string; qty: string; tax: string }
> = {
  drinks: {
    label: "Drinks",
    hint: "Beer, wine, spirits, cocktails, soft drinks, coffee and tea",
    cls: "1110170400",
    ty: "2",
    pkg: "NT",
    qty: "U",
    tax: "TAX_B",
  },
  food: {
    label: "Food",
    hint: "Starters, mains, grills, sides and desserts",
    cls: "1110160600",
    ty: "2",
    pkg: "NT",
    qty: "U",
    tax: "TAX_B",
  },
  service: {
    label: "Service",
    hint: "Corkage, delivery, room hire and other charges that are not goods",
    cls: "1110160600",
    ty: "3",
    pkg: "NT",
    qty: "U",
    tax: "TAX_B",
  },
};

/** The tax choices a product can carry. TAX_A is exempt; TAX_B is the standard 18% VAT. */
export const TAX_CHOICES = [
  { code: "TAX_B", label: "VAT 18% (standard)" },
  { code: "TAX_A", label: "Exempt (0%)" },
] as const;
