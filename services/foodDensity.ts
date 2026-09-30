// Densities (grams per millilitre) for foods people measure by the spoon or
// cup. Without these, a volume against a per-100 g reference is weighed as
// water: "a cup of oats" came out as 250 g (~950 kcal) instead of ~90 g.
// Values are typical for the food as it's usually spooned — loose, not packed.

interface DensityRule {
  /** Words that must all appear; the last one must be the description's final word (its head noun). */
  words: string[];
  gramsPerMl: number;
}

// The first match wins, so more specific rules come first ("cream cheese"
// before "cheese", "icing sugar" before "sugar").
const RULES: DensityRule[] = [
  // Cheese by the spoon/cup is grated — except these, which are spooned.
  { words: ['cream', 'cheese'], gramsPerMl: 1.0 },
  { words: ['cottage', 'cheese'], gramsPerMl: 1.0 },
  { words: ['macaroni', 'cheese'], gramsPerMl: 1.0 },
  { words: ['cheese'], gramsPerMl: 0.45 },
  { words: ['cheddar'], gramsPerMl: 0.45 },
  { words: ['mozzarella'], gramsPerMl: 0.45 },
  { words: ['parmesan'], gramsPerMl: 0.4 },
  // Cereals and grains
  { words: ['oat'], gramsPerMl: 0.36 },
  { words: ['granola'], gramsPerMl: 0.45 },
  { words: ['muesli'], gramsPerMl: 0.45 },
  { words: ['cornflake'], gramsPerMl: 0.12 },
  { words: ['corn', 'flake'], gramsPerMl: 0.12 },
  { words: ['bran', 'flake'], gramsPerMl: 0.16 },
  { words: ['rice', 'krispie'], gramsPerMl: 0.12 },
  { words: ['cereal'], gramsPerMl: 0.15 },
  { words: ['rice'], gramsPerMl: 0.8 },
  { words: ['couscous'], gramsPerMl: 0.7 },
  { words: ['quinoa'], gramsPerMl: 0.72 },
  { words: ['lentil'], gramsPerMl: 0.8 },
  { words: ['pasta'], gramsPerMl: 0.5 },
  { words: ['penne'], gramsPerMl: 0.5 },
  { words: ['fusilli'], gramsPerMl: 0.5 },
  { words: ['macaroni'], gramsPerMl: 0.5 },
  { words: ['popcorn'], gramsPerMl: 0.035 },
  { words: ['breadcrumb'], gramsPerMl: 0.45 },
  // Baking
  { words: ['flour'], gramsPerMl: 0.53 },
  { words: ['icing', 'sugar'], gramsPerMl: 0.5 },
  { words: ['sugar'], gramsPerMl: 0.85 },
  { words: ['cocoa', 'powder'], gramsPerMl: 0.45 },
  { words: ['protein', 'powder'], gramsPerMl: 0.4 },
  { words: ['desiccated', 'coconut'], gramsPerMl: 0.35 },
  { words: ['chocolate', 'chip'], gramsPerMl: 0.7 },
  // Nuts, seeds and dried fruit
  { words: ['almond'], gramsPerMl: 0.6 },
  { words: ['peanut'], gramsPerMl: 0.6 },
  { words: ['cashew'], gramsPerMl: 0.55 },
  { words: ['walnut'], gramsPerMl: 0.45 },
  { words: ['pecan'], gramsPerMl: 0.45 },
  { words: ['nut'], gramsPerMl: 0.55 },
  { words: ['seed'], gramsPerMl: 0.6 },
  { words: ['raisin'], gramsPerMl: 0.65 },
  { words: ['sultana'], gramsPerMl: 0.65 },
  // Spreads, syrups and fats (denser or lighter than water)
  { words: ['peanut', 'butter'], gramsPerMl: 1.07 },
  { words: ['honey'], gramsPerMl: 1.42 },
  { words: ['syrup'], gramsPerMl: 1.35 },
  { words: ['jam'], gramsPerMl: 1.33 },
  { words: ['oil'], gramsPerMl: 0.92 },
  // Fruit and veg
  { words: ['blueberry'], gramsPerMl: 0.6 },
  { words: ['raspberry'], gramsPerMl: 0.5 },
  { words: ['strawberry'], gramsPerMl: 0.6 },
  { words: ['berry'], gramsPerMl: 0.6 },
  { words: ['grape'], gramsPerMl: 0.6 },
  { words: ['pea'], gramsPerMl: 0.6 },
  { words: ['sweetcorn'], gramsPerMl: 0.65 },
  { words: ['spinach'], gramsPerMl: 0.12 },
  { words: ['kale'], gramsPerMl: 0.1 },
  { words: ['lettuce'], gramsPerMl: 0.1 },
  { words: ['rocket'], gramsPerMl: 0.08 },
  // Frozen
  { words: ['ice', 'cream'], gramsPerMl: 0.55 },
];

/** Whether `token` is `word` or a plural of it ("oats", "berries", "peas"). */
const isForm = (token: string, word: string): boolean =>
  token === word ||
  token === `${word}s` ||
  token === `${word}es` ||
  (word.endsWith('y') && token === `${word.slice(0, -1)}ies`);

/**
 * The density of the food a description names, or null when it isn't a food
 * we know to differ from water. Mixed dishes ("oats with milk", "rice and
 * beans") are left alone: no single density applies to them.
 */
export const densityFor = (description: string): number | null => {
  const tokens: string[] = description.toLowerCase().match(/[a-z]+/g) ?? [];
  if (tokens.length === 0 || tokens.includes('and') || tokens.includes('with')) return null;
  const head = tokens[tokens.length - 1];

  const rule = RULES.find(
    ({ words }) => isForm(head, words[words.length - 1]) && words.every((word) => tokens.some((t) => isForm(t, word)))
  );
  return rule?.gramsPerMl ?? null;
};
