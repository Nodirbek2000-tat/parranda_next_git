/** Product pickers for deliveries (FEED) and visit drugs (dori). `GET /api/products` returns a plain array. */
import type { Product } from "./types";

export const PRODUCTS_PATH = "/products";

const FEED = new Set(["yem", "feed"]);
const DRUG = new Set(["dori", "drug", "vet"]);

export function isFeed(p: Product): boolean {
  return FEED.has(String(p.category).toLowerCase());
}

export function isDrug(p: Product): boolean {
  return DRUG.has(String(p.category).toLowerCase());
}
