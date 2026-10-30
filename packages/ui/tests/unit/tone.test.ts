import { describe, expect, test } from "vitest";

import { formatNumber, formatRwf } from "../../src/format.tsx";
import { type Tone, toneBg, toneColor, toneStatus, toneText } from "../../src/tone.ts";

describe("toneColor", () => {
  test("HeroUI has no info colour, so info renders as accent", () => {
    expect(toneColor("info")).toBe("accent");
  });

  test("every other tone is its own HeroUI colour", () => {
    for (const tone of ["accent", "success", "warning", "danger", "default"] as const) {
      expect(toneColor(tone)).toBe(tone);
    }
  });

  test("no tone is the default colour", () => {
    expect(toneColor(null)).toBe("default");
    expect(toneColor(undefined)).toBe("default");
  });
});

describe("toneStatus", () => {
  test("accent and info mark the current step of a timeline", () => {
    expect(toneStatus("accent")).toBe("current");
    expect(toneStatus("info")).toBe("current");
  });

  test("the timeline's own states pass through, and no tone is the default", () => {
    expect(toneStatus("muted")).toBe("muted");
    expect(toneStatus("current")).toBe("current");
    expect(toneStatus("danger")).toBe("danger");
    expect(toneStatus(null)).toBe("default");
  });
});

describe("toneText and toneBg", () => {
  const roles: [Tone | null, string][] = [
    ["success", "success"],
    ["warning", "warning"],
    ["danger", "danger"],
    ["accent", "accent"],
    ["info", "accent"],
    ["default", "muted"],
    [null, "muted"],
  ];

  test.each(roles)("%s reads the %s role, never a palette colour", (tone, role) => {
    expect(toneText(tone)).toBe(`text-${role}`);
    expect(toneBg(tone)).toBe(`bg-${role}`);
  });
});

describe("formatRwf", () => {
  // Intl separates the code from the amount with a no-break space (U+00A0), so a price never wraps
  // between "RWF" and its number.
  test("reads as RWF and the grouped amount, held together by a no-break space", () => {
    expect(formatRwf(118400)).toBe("RWF 118,400");
  });

  test("compact amounts keep one decimal", () => {
    expect(formatRwf(7_900_000, true)).toBe("RWF 7.9M");
  });

  test("formatNumber groups in threes", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
