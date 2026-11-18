import { describe, expect, it } from "vitest";
import { CATALOG, clipStyleScore, recommendForCategory, THEMES } from "@/shared/lib/catalog";
import type { ProductCategory } from "@/shared/types";

const FURNITURE: ProductCategory[] = ["bed", "wardrobe", "table", "chair", "desk", "sofa", "shelf"];
const anything = () => true;

describe("catalog", () => {
  it.each(FURNITURE)("has exactly one %s in every theme", (category) => {
    for (const theme of THEMES) {
      const inTheme = CATALOG.filter((p) => p.category === category && p.theme === theme.toLowerCase());
      expect(inTheme, theme).toHaveLength(1);
    }
  });

  it("uses a unique id and photo for every product", () => {
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);
    expect(new Set(CATALOG.map((p) => p.image_url)).size).toBe(CATALOG.length);
  });
});

describe("recommendForCategory", () => {
  it.each(THEMES)("puts the %s product first in every category", (theme) => {
    for (const category of FURNITURE) {
      const [top] = recommendForCategory(category, anything, 1_000_000, theme);
      expect(top.product.theme, `${category}`).toBe(theme.toLowerCase());
    }
  });

  it("shows a different set of options for each theme", () => {
    const optionsFor = (theme: string) =>
      FURNITURE.flatMap((c) => recommendForCategory(c, anything, 1_000_000, theme).map((m) => m.product.id)).join();
    expect(new Set(THEMES.map(optionsFor)).size).toBe(THEMES.length);
  });

  it("follows up with the closest neighbouring themes", () => {
    const themes = recommendForCategory("sofa", anything, 1_000_000, "Traditional").map((m) => m.product.theme);
    expect(themes).toEqual(["traditional", "bohemian", "scandinavian"]);
  });

  it("still respects the budget and the fit check", () => {
    const cheap = recommendForCategory("bed", anything, 17000, "Bohemian");
    expect(cheap.every((m) => m.product.price <= 17000)).toBe(true);
    const narrow = recommendForCategory("bed", (p) => p.width_cm <= 150, 1_000_000, "Bohemian");
    expect(narrow.every((m) => m.product.width_cm <= 150)).toBe(true);
  });
});

describe("clipStyleScore", () => {
  const sofa = (theme: string) => CATALOG.find((p) => p.category === "sofa" && p.theme === theme)!;

  it("understands free-text styles", () => {
    expect(clipStyleScore(sofa("scandinavian"), "warm nordic look")).toBe(0.92);
    expect(clipStyleScore(sofa("bohemian"), "a bit boho")).toBe(0.92);
    expect(clipStyleScore(sofa("industrial"), "something cosy")).toBe(0.45);
  });

  it("scores closer themes higher", () => {
    const query = "Modern";
    expect(clipStyleScore(sofa("minimalist"), query)).toBeGreaterThan(clipStyleScore(sofa("scandinavian"), query));
    expect(clipStyleScore(sofa("scandinavian"), query)).toBeGreaterThan(clipStyleScore(sofa("traditional"), query));
  });
});
