// Branded products from Open Food Facts, for when the user names a brand
// ("Heinz beans", "Müller Corner"). CoFID only has generic foods.

import { tokenize } from './search.ts';

export interface ProductNutrition {
  name: string;
  /** Per 100 g (Open Food Facts gives drinks per 100 ml under the same keys). */
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre: number | null;
  /** mg */
  sodium: number | null;
  sugar: number | null;
}

interface OffProduct {
  product_name?: string;
  /** A list from the search service; a comma-separated string elsewhere. */
  brands?: string[] | string | null;
  nutriments?: Record<string, number | string | undefined> | null;
}

// Open Food Facts' search service; the older /cgi/search.pl is heavily rate
// limited and often answers 503.
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
// Open Food Facts asks every client to identify itself.
const USER_AGENT = 'EatLog/1.0 (https://github.com/ryanborroff/EatLog)';
const TIMEOUT_MS = 3500;
const MAX_PRODUCTS = 6;

const brandsOf = (product: OffProduct): string =>
  Array.isArray(product.brands) ? product.brands.join(', ') : product.brands ?? '';

const num = (value: number | string | undefined): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/**
 * A product's nutrition, or null when it's missing or can't be right. Crowd-
 * sourced records include kJ typed as kcal (27,200 "kcal" of beans) and
 * per-serving values typed as per-100 g, so the same checks as for the AI's
 * estimates apply: no more than pure fat's energy density, no more than
 * 100 g of macros per 100 g, and calories that roughly match the macros.
 */
export const toNutrition = (product: OffProduct): ProductNutrition | null => {
  const n = product.nutriments ?? {};
  const calories = num(n['energy-kcal_100g']);
  const protein = num(n['proteins_100g']);
  const carbohydrate = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  const brand = brandsOf(product).split(',')[0]?.trim();
  const productName = product.product_name?.trim();
  // Many product names already start with the brand ("Heinz Baked Beans").
  const name =
    brand && productName && !productName.toLowerCase().startsWith(brand.toLowerCase())
      ? `${brand} ${productName}`
      : productName ?? '';
  if (!name || calories === null || protein === null || carbohydrate === null || fat === null) return null;
  if ([calories, protein, carbohydrate, fat].some((v) => v < 0)) return null;
  if (calories > 920 || protein + carbohydrate + fat > 105) return null;

  const fromMacros = protein * 4 + carbohydrate * 4 + fat * 9;
  const alcoholic = /\b(beer|lager|ale|cider|wine|gin|vodka|whisky|rum|spirit|liqueur)\b/i.test(name);
  if (!alcoholic && Math.abs(calories - fromMacros) > Math.max(20, 0.35 * Math.max(calories, fromMacros))) return null;

  const sodiumGrams = num(n['sodium_100g']);
  return {
    name,
    calories,
    protein,
    carbohydrate,
    fat,
    fibre: num(n['fiber_100g']),
    sodium: sodiumGrams === null ? null : sodiumGrams * 1000,
    sugar: num(n['sugars_100g']),
  };
};

/** Whether a product is by the named brand: every word of the brand appears in its brand or name. */
const byBrand = (product: OffProduct, brand: string): boolean => {
  const have = new Set(tokenize(`${brandsOf(product)} ${product.product_name ?? ''}`));
  return tokenize(brand).every((word) => have.has(word));
};

/**
 * Up to six plausible products by `brand` matching `description`. Returns
 * [] on any failure — branded lookup only ever adds candidates, so an
 * unreachable or slow Open Food Facts must not break matching.
 */
export const searchBranded = async (brand: string, description: string): Promise<ProductNutrition[]> => {
  const params = new URLSearchParams({
    q: `${brand} ${description}`,
    page_size: '15',
    fields: 'product_name,brands,nutriments',
  });
  try {
    const response = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { hits?: OffProduct[] };

    const seen = new Set<string>();
    const products: ProductNutrition[] = [];
    for (const product of data.hits ?? []) {
      if (!byBrand(product, brand)) continue;
      const nutrition = toNutrition(product);
      const key = nutrition?.name.toLowerCase();
      if (!nutrition || !key || seen.has(key)) continue;
      seen.add(key);
      products.push(nutrition);
      if (products.length === MAX_PRODUCTS) break;
    }
    return products;
  } catch (error) {
    console.error('Open Food Facts search failed:', error);
    return [];
  }
};
