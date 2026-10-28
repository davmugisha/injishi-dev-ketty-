import type { Metadata } from "next";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { fetchPublicProperty, type PublicProperty } from "@/data/public-property";
import { propertyMetadata, resolvePropertyPage } from "@/lib/property-route";

// The read itself goes to the API through Next's cache. What is tested here is what the route does with
// each of its three answers, so the read is stood in for.
vi.mock("@/data/public-property", () => ({ fetchPublicProperty: vi.fn() }));
const read = vi.mocked(fetchPublicProperty);

// Passed through untouched, so only the fields a reader would recognise are filled in.
const property = {
  id: "8f6b2a4e-3c1d-4e5f-9a7b-0c2d4e6f8a1b",
  slug: "lake-kivu-lodge",
  name: "Lake Kivu Lodge",
} satisfies Partial<PublicProperty> as PublicProperty;

beforeEach(() => {
  read.mockReset();
});

describe("resolvePropertyPage", () => {
  test("a published property is the page, exactly as the API sent it", async () => {
    read.mockResolvedValue({ status: "found", property });
    await expect(resolvePropertyPage("lake-kivu-lodge")).resolves.toBe(property);
    expect(read).toHaveBeenCalledWith("lake-kivu-lodge");
  });

  test("a property the API does not hold is null, so the page renders its 404", async () => {
    read.mockResolvedValue({ status: "absent" });
    await expect(resolvePropertyPage("gone")).resolves.toBeNull();
  });

  test("an API that could not be asked throws, rather than caching a 404 over a live listing", async () => {
    read.mockResolvedValue({ status: "unreachable" });
    await expect(resolvePropertyPage("lake-kivu-lodge")).rejects.toThrow(
      'The property read for "lake-kivu-lodge" could not reach the API.',
    );
  });
});

describe("propertyMetadata", () => {
  const build = vi.fn((p: PublicProperty, slug: string): Metadata => ({ title: `${p.name} (${slug})` }));

  beforeEach(() => {
    build.mockClear();
  });

  test("builds the page's metadata from the property it resolved and the slug", async () => {
    read.mockResolvedValue({ status: "found", property });
    const metadata = await propertyMetadata(Promise.resolve({ slug: "lake-kivu-lodge" }), build);
    expect(metadata).toEqual({ title: "Lake Kivu Lodge (lake-kivu-lodge)" });
    expect(build).toHaveBeenCalledWith(property, "lake-kivu-lodge");
  });

  test("an unknown slug is empty metadata, and the 404 is left to the page", async () => {
    read.mockResolvedValue({ status: "absent" });
    await expect(propertyMetadata(Promise.resolve({ slug: "gone" }), build)).resolves.toEqual({});
    expect(build).not.toHaveBeenCalled();
  });

  test("an unreachable API fails the metadata too, never an empty answer", async () => {
    read.mockResolvedValue({ status: "unreachable" });
    await expect(propertyMetadata(Promise.resolve({ slug: "lake-kivu-lodge" }), build)).rejects.toThrow(
      "could not reach the API",
    );
    expect(build).not.toHaveBeenCalled();
  });
});
