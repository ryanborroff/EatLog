// Fallback path when voice/text parsing fails on a packaged food: look the
// barcode up directly instead of relying on the AI to guess the product.
// Open Food Facts is free, keyless, and has the broadest packaged-food
// coverage — a good fit for a lightweight fallback rather than a core dep.

import { ReferenceNutrition } from './nutritionCalculator';

export interface BarcodeProduct {
  name: string;
  reference: ReferenceNutrition;
}

interface OffResponse {
  status: number;
  product?: {
    product_name?: string;
    serving_size?: string;
    nutriments?: Record<string, number>;
  };
}

export const lookupBarcode = async (barcode: string): Promise<BarcodeProduct | null> => {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
  if (!response.ok) return null;

  const data: OffResponse = await response.json();
  if (data.status !== 1 || !data.product) return null;

  const { product_name, nutriments } = data.product;
  if (!product_name || !nutriments) return null;

  const calories = nutriments['energy-kcal_100g'];
  if (calories == null) return null;

  return {
    name: product_name,
    reference: {
      servingSize: 100,
      servingUnit: 'g',
      calories,
      protein: nutriments['proteins_100g'] ?? 0,
      carbohydrate: nutriments['carbohydrates_100g'] ?? 0,
      fat: nutriments['fat_100g'] ?? 0,
      fibre: nutriments['fiber_100g'] ?? undefined,
    },
  };
};
