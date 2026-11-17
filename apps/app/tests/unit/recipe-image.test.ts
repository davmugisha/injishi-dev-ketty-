import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  dishPhoto,
  finalPhoto,
  isUpload,
  libraryPhoto,
  MENU_LIBRARY,
  suggestedPhoto,
  uploadSrc,
} from "@/features/pos/dish-art";

const FILES = readdirSync(join(__dirname, "../../public/menu"))
  .filter((f) => f.endsWith(".jpg"))
  .map((f) => f.replace(/\.jpg$/, ""))
  .sort();

describe("the photo library", () => {
  test("offers every photograph in /public/menu, once, and nothing that is not there", () => {
    const ids = MENU_LIBRARY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(FILES);
  });
  test("every suggestion is a photo the library holds", () => {
    for (const name of [
      "Primus, 72 cl",
      "Grilled whole tilapia",
      "Mojito",
      "Beef brochettes",
      "Chips",
      "Birthday set-up",
    ]) {
      const id = suggestedPhoto(name);
      expect(id, name).not.toBeNull();
      expect(libraryPhoto(id), name).toBeDefined();
    }
  });
});

describe("the recipe image", () => {
  test("the name suggests a photo, and the suggestion follows the name", () => {
    expect(finalPhoto(null, "Primus", "")).toBe("beer");
    expect(finalPhoto(null, "Grilled chicken", "")).toBe("grilled_chicken");
    expect(finalPhoto(null, "", "")).toBeNull();
    expect(finalPhoto(null, "Zxq", "")).toBeNull();
    expect(finalPhoto(null, "House special", "Desserts")).toBe("ice_cream");
  });
  test("a photo the owner chose wins over the suggestion, whatever the name says", () => {
    expect(finalPhoto("sambaza", "Grilled chicken", "")).toBe("sambaza");
    expect(finalPhoto("sambaza", "", "")).toBe("sambaza");
  });
  test("an id the library does not hold is ignored, not shown", () => {
    expect(finalPhoto("not_a_photo", "Primus", "")).toBe("beer");
    expect(dishPhoto("Primus", "", "not_a_photo")).toBe("/menu/beer.jpg");
  });
  test("every screen shows the saved photo first", () => {
    expect(dishPhoto("Primus", "Beer", "whisky")).toBe("/menu/whisky.jpg");
    expect(dishPhoto("Primus", "Beer", null)).toBe("/menu/beer.jpg");
    expect(dishPhoto("Zxq", "", undefined)).toBeNull();
  });
});

describe("an uploaded photo", () => {
  const ITEM = "742fd289-acaf-4b2f-84f8-5216b552714a";
  const STORED = "0b5a2f8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
  test("a saved upload is served through the app, with its version", () => {
    expect(uploadSrc(`upload:${ITEM}.3fa9c1d2e4b5`)).toBe(`/api/pos/menu-photo/${ITEM}?v=3fa9c1d2e4b5`);
    expect(dishPhoto("Primus", "Beer", `upload:${ITEM}.3fa9c1d2e4b5`)).toBe(
      `/api/pos/menu-photo/${ITEM}?v=3fa9c1d2e4b5`,
    );
  });
  test("a new upload (not saved yet) has no address of its own, and anything else is not an upload", () => {
    expect(isUpload(`upload:${STORED}`)).toBe(true);
    expect(uploadSrc(`upload:${STORED}`)).toBeNull();
    expect(uploadSrc("beer")).toBeNull();
    expect(uploadSrc("upload:../../etc.passwd")).toBeNull();
    expect(isUpload("beer")).toBe(false);
    expect(isUpload(null)).toBe(false);
  });
  test("the owner's upload wins over the library and the suggestion when the recipe is saved", () => {
    expect(finalPhoto(`upload:${STORED}`, "Primus", "Beer")).toBe(`upload:${STORED}`);
    expect(finalPhoto(`upload:${ITEM}.3fa9c1d2e4b5`, "Primus", "")).toBe(`upload:${ITEM}.3fa9c1d2e4b5`);
  });
});
