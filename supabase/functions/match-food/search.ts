// Shortlists reference foods for a spoken description, so the AI can pick the
// right one from real data instead of estimating nutrition from memory.
// Pure and dependency-free so it can be unit-tested outside Deno.

export interface CatalogueEntry {
  id: string;
  name: string;
}

// Words that say nothing about which food it is.
const STOPWORDS = new Set(['a', 'an', 'and', 'the', 'of', 'with', 'in', 'on', 'my', 'some', 'bit', 'piece', 'portion', 'serving', 'plate', 'bowl']);

// Everyday UK words -> the words CoFID uses.
const SYNONYMS: Record<string, string[]> = {
  yoghurt: ['yogurt'],
  hummus: ['houmous'],
  humous: ['houmous'],
  chickpea: ['chick', 'pea'],
  grill: ['grilled'],
  roast: ['roasted'],
  fry: ['fried'],
  bake: ['baked'],
  boil: ['boiled'],
  steam: ['steamed'],
  scramble: ['scrambled'],
  poach: ['poached'],
  battered: ['batter'],
  breaded: ['breadcrumb'],
  dal: ['dahl'],
  dhal: ['dahl'],
};

/** A crude singular form: "potatoes" -> "potato", "berries" -> "berry", "eggs" -> "egg". */
const stem = (word: string): string => {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
};

export const tokenize = (text: string): string[] =>
  (text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z]+/g) ?? [])
    .filter((word) => !STOPWORDS.has(word))
    .flatMap((word) => SYNONYMS[stem(word)] ?? [stem(word)]);

export interface CatalogueIndex {
  foods: { entry: CatalogueEntry; words: Set<string> }[];
  /** How distinctive each word is: "tikka" says far more than "chicken" or "raw". */
  weight: Map<string, number>;
}

export const indexCatalogue = (entries: CatalogueEntry[]): CatalogueIndex => {
  const foods = entries.map((entry) => ({ entry, words: new Set(tokenize(entry.name)) }));
  const counts = new Map<string, number>();
  for (const { words } of foods) for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const weight = new Map<string, number>();
  for (const [word, count] of counts) weight.set(word, Math.log(1 + foods.length / count));
  return { foods, weight };
};

/**
 * The `limit` catalogue entries that best match a description: the summed
 * distinctiveness of the description's words each name contains, less a
 * little for every extra word in the name, so "Bananas, flesh only" beats
 * "Banana bread, homemade" for "banana".
 */
export const shortlist = (index: CatalogueIndex, description: string, limit = 12): CatalogueEntry[] => {
  const words = [...new Set(tokenize(description))].filter((word) => index.weight.has(word));
  if (words.length === 0) return [];

  const scored: { entry: CatalogueEntry; score: number }[] = [];
  for (const food of index.foods) {
    let score = 0;
    let matched = 0;
    for (const word of words) {
      if (food.words.has(word)) {
        score += index.weight.get(word)!;
        matched += 1;
      }
    }
    if (matched === 0) continue;
    scored.push({ entry: food.entry, score: score - (food.words.size - matched) * 0.3 });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.name.length - b.entry.name.length)
    .slice(0, limit)
    .map(({ entry }) => entry);
};
