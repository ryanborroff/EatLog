import { readFileSync } from 'fs';
import { join } from 'path';
import { indexCatalogue, shortlist } from '../../supabase/functions/match-food/search';

// The real CoFID catalogue, read from the migration that loads it.
const ROW = /^\s+\('((?:[^']|'')*)', .*'cofid', '([^']+)'\)[,;]?$/;
const catalogue = readFileSync(join(__dirname, '../../supabase/migrations/0009_cofid_foods.sql'), 'utf8')
  .split('\n')
  .map((line) => ROW.exec(line))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => ({ id: m[2], name: m[1].replace(/''/g, "'") }));
const index = indexCatalogue(catalogue);

const names = (description: string, limit = 12) => shortlist(index, description, limit).map((e) => e.name);

describe('match-food shortlist over CoFID', () => {
  it('loads the whole catalogue', () => {
    expect(catalogue.length).toBeGreaterThan(2800);
  });

  it.each([
    ['grilled chicken breast', 'Chicken, breast, grilled without skin, meat only'],
    ['chicken tikka masala', 'Curry, chicken tikka masala, retail, reheated'],
    ['lasagne', 'Lasagne, homemade'],
    ['vegetable risotto', 'Risotto, vegetable, brown rice'],
    ['scotch egg', 'Scotch eggs, retail'],
    ['hummus', 'Houmous'],
    ['garlic bread', 'Bread, garlic and herb, retail'],
    ['greek yoghurt', 'Yogurt, Greek style, plain'],
    ['chickpeas', 'Beans, chick peas, canned, re-heated, drained'],
    ['banana', 'Bananas, flesh only'],
    ['battered cod', 'Cod, in batter, fried, takeaway'],
    ['beef lasagne', 'Lasagne, homemade'],
    ['bread and butter pudding', 'Pudding, bread and butter, homemade'],
  ])('shortlists the right food for "%s"', (description, expected) => {
    expect(names(description)).toContain(expected);
  });

  it('returns nothing for words no food has', () => {
    expect(names('xylophone')).toEqual([]);
  });
});
