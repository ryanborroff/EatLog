# Text normalization rules

Scoped down from a much larger recipe-app (Kitchen Wizz) rule set — most of
that pipeline (title cleanup, prep-descriptor stripping, dialect conversion,
oil canonicalization, shopping lists) doesn't apply here: EatLog logs food
diary entries, it doesn't manage recipes or shopping lists. These three
rules address real gaps in how [`foodResolver.ts`](../services/foodResolver.ts)
and [`defaultsMatcher.ts`](../services/defaultsMatcher.ts) currently compare
text — both do nothing more than `trim().toLowerCase()` today.

## 1. Unit vocabulary (for unit-equality checks)

`foodResolver.ts` decides whether a parsed item's unit matches a reference
food's `serving_unit` (`sameUnit` in `resolveOne`, both branches). Right now
`"g"` vs `"gram"` or `"grams"` compares unequal, which silently downgrades
confidence to `'low'` and marks the item `estimated: true` even when the
units are actually the same.

Canonical unit map (aliases → canonical form), limited to units that
actually appear in food-diary quantities — no culinary/cooking units
(`sprig`, `wedge`, `knob`, etc.) since there's no recipe/ingredient text here:

```
g, gram, grams              → g
kg, kilogram, kilograms     → kg
ml, millilitre, milliliter, millilitres, milliliters → ml
l, litre, liter, litres, liters → l
oz, ounce, ounces           → oz
lb, lbs, pound, pounds      → lb
cup, cups                   → cup
tbsp, tablespoon, tablespoons → tbsp
tsp, teaspoon, teaspoons    → tsp
serving, servings           → serving
whole                       → whole
piece, pieces               → piece
slice, slices               → slice
```

Sort by length descending before building any regex alternation (matches
rule #2's original intent — avoids a short alias matching inside a longer
one).

## 2. Unit casing/whitespace cleanup

Applies before the lookup above, so voice-transcribed or AI-parsed units in
inconsistent casing/spacing still resolve:

* Trim and collapse internal whitespace.
* Lowercase the whole unit string (units are never displayed capitalized in
  this app — see `formatFoodItem.ts`, which already assumes lowercase
  units glued to the quantity, e.g. `"250ml"`).
* No decimal-rounding or unit-gap-closing rules are needed — `quantity` and
  `unit` are already separate fields (`ParsedFoodItem.quantity: number`,
  `.unit: string`), never a combined free-text string to parse apart.

## 3. Matching normalization (internal only, never shown to users)

Applies to the `description`/`name`/`nickname`/`alias` strings compared in
`findPersonalFood`, `findFoodDefault`, `findReferenceFood`
(`foodResolver.ts`) and the default-name substring match in
`matchDefault` (`defaultsMatcher.ts`). Purely for matching — never mutates
what's stored or displayed.

* Lowercase, trim, collapse whitespace (current behavior, kept).
* Strip common qualifier words that don't change what food it is:
  `fresh, organic, whole, raw, cooked, frozen, canned`.
* Singularize simple plurals (`eggs` → `egg`, `bananas` → `banana`) so
  "2 eggs" matches a reference food row named "Egg". Simple suffix rule
  only (`-ies` → `-y`, trailing `-s` off unless the word ends `-ss`/`-us`) —
  no need for a full lemmatizer given the vocabulary is short food names,
  not arbitrary English.
* No category-bucketing beyond this — EatLog has no shopping-list
  categories to bucket into; this normalization only feeds direct
  name/alias/nickname equality and substring checks.
