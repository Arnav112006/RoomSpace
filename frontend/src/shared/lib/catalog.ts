import type { Product, ProductCategory } from "@/shared/types";
import { API_BASE_URL } from "./api";
import { furnitureTypeIn } from "./furniture";

/** Product category for a placement label: a furniture type, or lamp/decor. */
export function categoryForLabel(label: string): ProductCategory {
  const furniture = furnitureTypeIn(label);
  if (furniture) return furniture;
  const lower = label.toLowerCase();
  if (lower.includes("lamp")) return "lamp";
  if (lower.includes("decor") || lower.includes("plant")) return "decor";
  return "other";
}

/** Real product photo, served by the backend from app/static/products. */
export function productImageUrl(product: Product): string {
  return `${API_BASE_URL}/static/products/${product.image_url}.jpg`;
}

// Stand-in product catalog. In production this is the real product
// feed described in backend/app/services/product_filter.py +
// product_recommendation.py; the shape here matches Product exactly so
// swapping in a live /api/rooms/{id}/recommendations endpoint later is
// a data-source change, not a UI change.

export const CATALOG: Product[] = [
  { id: "p-sofa-01", name: "Harlow 2-Seater Sofa", category: "sofa", image_url: "sofa-modern", product_url: "https://example-furniture.test/harlow-sofa", price: 24999, width_cm: 180, depth_cm: 90, height_cm: 80, theme: "modern" },
  { id: "p-sofa-02", name: "Wren Linen Sofa", category: "sofa", image_url: "sofa-scandi", product_url: "https://example-furniture.test/wren-sofa", price: 21999, width_cm: 170, depth_cm: 85, height_cm: 78, theme: "scandinavian" },
  { id: "p-sofa-03", name: "Marrakesh Kilim Sofa", category: "sofa", image_url: "sofa-boho", product_url: "https://example-furniture.test/marrakesh-sofa", price: 27999, width_cm: 190, depth_cm: 95, height_cm: 82, theme: "bohemian" },
  { id: "p-bed-01", name: "Oslo Platform Bed", category: "bed", image_url: "bed-scandi", product_url: "https://example-furniture.test/oslo-bed", price: 18999, width_cm: 150, depth_cm: 200, height_cm: 40, theme: "scandinavian" },
  { id: "p-bed-02", name: "Foundry Iron-Frame Bed", category: "bed", image_url: "bed-industrial", product_url: "https://example-furniture.test/foundry-bed", price: 22999, width_cm: 150, depth_cm: 205, height_cm: 110, theme: "industrial" },
  { id: "p-bed-03", name: "Windsor Panel Bed", category: "bed", image_url: "bed-traditional", product_url: "https://example-furniture.test/windsor-bed", price: 26999, width_cm: 160, depth_cm: 210, height_cm: 120, theme: "traditional" },
  { id: "p-table-01", name: "Pebble Coffee Table", category: "table", image_url: "table-minimal", product_url: "https://example-furniture.test/pebble-table", price: 6499, width_cm: 100, depth_cm: 55, height_cm: 42, theme: "minimalist" },
  { id: "p-table-02", name: "Foundry Reclaimed-Wood Table", category: "table", image_url: "table-industrial", product_url: "https://example-furniture.test/foundry-table", price: 8999, width_cm: 140, depth_cm: 80, height_cm: 75, theme: "industrial" },
  { id: "p-table-03", name: "Lotus Rattan Side Table", category: "table", image_url: "table-boho", product_url: "https://example-furniture.test/lotus-table", price: 3499, width_cm: 45, depth_cm: 45, height_cm: 50, theme: "bohemian" },
  { id: "p-chair-01", name: "Bruno Accent Chair", category: "chair", image_url: "chair-modern", product_url: "https://example-furniture.test/bruno-chair", price: 8499, width_cm: 70, depth_cm: 75, height_cm: 80, theme: "modern" },
  { id: "p-chair-02", name: "Lund Wishbone Chair", category: "chair", image_url: "chair-scandi", product_url: "https://example-furniture.test/lund-chair", price: 6999, width_cm: 55, depth_cm: 55, height_cm: 78, theme: "scandinavian" },
  { id: "p-desk-01", name: "Meridian Writing Desk", category: "desk", image_url: "desk-minimal", product_url: "https://example-furniture.test/meridian-desk", price: 9999, width_cm: 120, depth_cm: 60, height_cm: 75, theme: "minimalist" },
  { id: "p-wardrobe-01", name: "Kessler 3-Door Wardrobe", category: "wardrobe", image_url: "wardrobe-classic", product_url: "https://example-furniture.test/kessler-wardrobe", price: 32999, width_cm: 150, depth_cm: 60, height_cm: 210, theme: "traditional" },
  { id: "p-shelf-01", name: "Ladder Bookshelf", category: "shelf", image_url: "shelf-modern", product_url: "https://example-furniture.test/ladder-shelf", price: 6999, width_cm: 80, depth_cm: 30, height_cm: 180, theme: "modern" },
  // One product per theme for every furniture category, so switching the
  // theme on the products stage always shows a different set of options.
  { id: "p-sofa-04", name: "Arlo Low-Profile Sofa", category: "sofa", image_url: "sofa-minimal", product_url: "https://example-furniture.test/arlo-sofa", price: 19999, width_cm: 175, depth_cm: 85, height_cm: 72, theme: "minimalist" },
  { id: "p-sofa-05", name: "Bowery Leather Sofa", category: "sofa", image_url: "sofa-industrial", product_url: "https://example-furniture.test/bowery-sofa", price: 34999, width_cm: 185, depth_cm: 90, height_cm: 80, theme: "industrial" },
  { id: "p-sofa-06", name: "Versailles Striped Settee", category: "sofa", image_url: "sofa-traditional", product_url: "https://example-furniture.test/versailles-settee", price: 29999, width_cm: 165, depth_cm: 80, height_cm: 95, theme: "traditional" },
  { id: "p-bed-04", name: "Nova Upholstered Bed", category: "bed", image_url: "bed-modern", product_url: "https://example-furniture.test/nova-bed", price: 24999, width_cm: 150, depth_cm: 205, height_cm: 105, theme: "modern" },
  { id: "p-bed-05", name: "Haven Low Bed", category: "bed", image_url: "bed-minimal", product_url: "https://example-furniture.test/haven-bed", price: 15999, width_cm: 150, depth_cm: 200, height_cm: 35, theme: "minimalist" },
  { id: "p-bed-06", name: "Luang Canopy Bed", category: "bed", image_url: "bed-boho", product_url: "https://example-furniture.test/luang-bed", price: 38999, width_cm: 160, depth_cm: 210, height_cm: 220, theme: "bohemian" },
  { id: "p-table-04", name: "Hairpin Coffee Table", category: "table", image_url: "table-modern", product_url: "https://example-furniture.test/hairpin-table", price: 7499, width_cm: 90, depth_cm: 50, height_cm: 40, theme: "modern" },
  { id: "p-table-05", name: "Fjord Oak Dining Table", category: "table", image_url: "table-scandi", product_url: "https://example-furniture.test/fjord-table", price: 17999, width_cm: 140, depth_cm: 80, height_cm: 75, theme: "scandinavian" },
  { id: "p-table-06", name: "Mahogany Extension Table", category: "table", image_url: "table-traditional", product_url: "https://example-furniture.test/mahogany-table", price: 24999, width_cm: 150, depth_cm: 90, height_cm: 76, theme: "traditional" },
  { id: "p-chair-03", name: "Shell Side Chair", category: "chair", image_url: "chair-minimal", product_url: "https://example-furniture.test/shell-chair", price: 4999, width_cm: 47, depth_cm: 52, height_cm: 81, theme: "minimalist" },
  { id: "p-chair-04", name: "Atelier Metal Chair", category: "chair", image_url: "chair-industrial", product_url: "https://example-furniture.test/atelier-chair", price: 3999, width_cm: 45, depth_cm: 50, height_cm: 84, theme: "industrial" },
  { id: "p-chair-05", name: "Regency Tapestry Armchair", category: "chair", image_url: "chair-traditional", product_url: "https://example-furniture.test/regency-armchair", price: 14999, width_cm: 60, depth_cm: 60, height_cm: 92, theme: "traditional" },
  { id: "p-chair-06", name: "Peacock Wicker Chair", category: "chair", image_url: "chair-boho", product_url: "https://example-furniture.test/peacock-chair", price: 11999, width_cm: 75, depth_cm: 70, height_cm: 150, theme: "bohemian" },
  { id: "p-desk-02", name: "Studio White Desk", category: "desk", image_url: "desk-modern", product_url: "https://example-furniture.test/studio-desk", price: 11499, width_cm: 120, depth_cm: 60, height_cm: 75, theme: "modern" },
  { id: "p-desk-03", name: "Birch Writing Desk", category: "desk", image_url: "desk-scandi", product_url: "https://example-furniture.test/birch-desk", price: 10999, width_cm: 110, depth_cm: 55, height_cm: 74, theme: "scandinavian" },
  { id: "p-desk-04", name: "Foundry Steel Desk", category: "desk", image_url: "desk-industrial", product_url: "https://example-furniture.test/foundry-desk", price: 8999, width_cm: 100, depth_cm: 60, height_cm: 76, theme: "industrial" },
  { id: "p-desk-05", name: "Marquetry Writing Desk", category: "desk", image_url: "desk-traditional", product_url: "https://example-furniture.test/marquetry-desk", price: 45999, width_cm: 130, depth_cm: 65, height_cm: 78, theme: "traditional" },
  { id: "p-desk-06", name: "Rattan Study Desk", category: "desk", image_url: "desk-boho", product_url: "https://example-furniture.test/rattan-desk", price: 8499, width_cm: 110, depth_cm: 55, height_cm: 75, theme: "bohemian" },
  { id: "p-wardrobe-02", name: "Lumen Walnut Wardrobe", category: "wardrobe", image_url: "wardrobe-modern", product_url: "https://example-furniture.test/lumen-wardrobe", price: 36999, width_cm: 120, depth_cm: 60, height_cm: 220, theme: "modern" },
  { id: "p-wardrobe-03", name: "Plain 2-Door Wardrobe", category: "wardrobe", image_url: "wardrobe-minimal", product_url: "https://example-furniture.test/plain-wardrobe", price: 21999, width_cm: 100, depth_cm: 58, height_cm: 200, theme: "minimalist" },
  { id: "p-wardrobe-04", name: "Pine Cottage Wardrobe", category: "wardrobe", image_url: "wardrobe-scandi", product_url: "https://example-furniture.test/pine-wardrobe", price: 24999, width_cm: 110, depth_cm: 55, height_cm: 195, theme: "scandinavian" },
  { id: "p-wardrobe-05", name: "Depot Steel Locker", category: "wardrobe", image_url: "wardrobe-industrial", product_url: "https://example-furniture.test/depot-locker", price: 15999, width_cm: 90, depth_cm: 50, height_cm: 180, theme: "industrial" },
  { id: "p-wardrobe-06", name: "Folk-Painted Armoire", category: "wardrobe", image_url: "wardrobe-boho", product_url: "https://example-furniture.test/folk-armoire", price: 39999, width_cm: 120, depth_cm: 60, height_cm: 205, theme: "bohemian" },
  { id: "p-shelf-02", name: "Ledge Picture Shelves", category: "shelf", image_url: "shelf-minimal", product_url: "https://example-furniture.test/ledge-shelves", price: 2999, width_cm: 90, depth_cm: 20, height_cm: 120, theme: "minimalist" },
  { id: "p-shelf-03", name: "Rail Wall Shelf", category: "shelf", image_url: "shelf-scandi", product_url: "https://example-furniture.test/rail-shelf", price: 5499, width_cm: 80, depth_cm: 25, height_cm: 75, theme: "scandinavian" },
  { id: "p-shelf-04", name: "Slotted-Steel Bookcase", category: "shelf", image_url: "shelf-industrial", product_url: "https://example-furniture.test/slotted-bookcase", price: 6499, width_cm: 90, depth_cm: 35, height_cm: 200, theme: "industrial" },
  { id: "p-shelf-05", name: "Carved Glass-Front Bookcase", category: "shelf", image_url: "shelf-traditional", product_url: "https://example-furniture.test/carved-bookcase", price: 42999, width_cm: 100, depth_cm: 40, height_cm: 210, theme: "traditional" },
  { id: "p-shelf-06", name: "Rattan Etagere", category: "shelf", image_url: "shelf-boho", product_url: "https://example-furniture.test/rattan-etagere", price: 4299, width_cm: 60, depth_cm: 35, height_cm: 160, theme: "bohemian" },
  { id: "p-lamp-01", name: "Halo Floor Lamp", category: "lamp", image_url: "lamp-modern", product_url: "https://example-furniture.test/halo-lamp", price: 4499, width_cm: 35, depth_cm: 35, height_cm: 150, theme: "modern" },
  { id: "p-decor-01", name: "Terracotta Planter Set", category: "decor", image_url: "decor-boho", product_url: "https://example-furniture.test/terracotta-planters", price: 2199, width_cm: 30, depth_cm: 30, height_cm: 40, theme: "bohemian" },
];

/** Stands in for the fine-tuned CLIP zero-shot score described in
 * ml/clip_matching/zero_shot.py — cosine-similarity-shaped, seeded by
 * theme keyword overlap so results are stable and explainable in a UI
 * without shipping a model to the browser. */
export function clipStyleScore(product: Product, styleText: string): number {
  const theme = (product.theme || "").toLowerCase();
  if (!theme) return 0.5;
  const wanted = themesIn(styleText);
  if (wanted.includes(theme)) return 0.92;
  // Otherwise score by how close the product's theme is to a wanted one.
  const ranks = wanted.map((w) => (THEME_NEIGHBOURS[w] ?? []).indexOf(theme)).filter((r) => r >= 0);
  if (ranks.length === 0) return 0.45;
  return [0.78, 0.68, 0.6][Math.min(...ranks)];
}

/** The themes offered in the app (Stage 1 and the products stage). */
export const THEMES = ["Modern", "Minimalist", "Scandinavian", "Industrial", "Traditional", "Bohemian"];

// Each theme's closest neighbours, closest first.
const THEME_NEIGHBOURS: Record<string, string[]> = {
  modern: ["minimalist", "scandinavian", "industrial"],
  minimalist: ["scandinavian", "modern", "industrial"],
  scandinavian: ["minimalist", "modern", "bohemian"],
  industrial: ["modern", "minimalist", "traditional"],
  traditional: ["bohemian", "scandinavian", "industrial"],
  bohemian: ["traditional", "scandinavian", "modern"],
};

const THEME_WORDS: Record<string, string[]> = {
  modern: ["modern", "contemporary", "sleek"],
  minimalist: ["minimal", "simple", "clean"],
  scandinavian: ["scandi", "nordic"],
  industrial: ["industrial", "loft", "urban", "raw"],
  traditional: ["traditional", "classic", "formal", "vintage"],
  bohemian: ["bohemian", "boho", "eclectic", "global"],
};

/** Catalog themes mentioned in free text, e.g. "warm nordic, a bit boho" (lowercase keys). */
export function themesIn(text: string): string[] {
  const query = text.toLowerCase();
  return Object.keys(THEME_WORDS).filter((t) => THEME_WORDS[t].some((w) => query.includes(w)));
}

/**
 * Top style matches in a category that are within budget and pass `fits`
 * — the caller decides what "fits" means (StageRecommendations checks the
 * product's real size in the room with the constraint rules).
 */
export function recommendForCategory(
  category: ProductCategory,
  fits: (product: Product) => boolean,
  budgetRemaining: number,
  styleText: string,
  topK = 3
): { product: Product; score: number }[] {
  const eligible = CATALOG.filter((p) => p.category === category && p.price <= budgetRemaining && fits(p));
  // Ties (same score) go to the cheaper product, so the order never depends
  // on where a product happens to sit in the catalog.
  return eligible
    .map((product) => ({ product, score: clipStyleScore(product, styleText) }))
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .slice(0, topK);
}
