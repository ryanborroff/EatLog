import { layoutAxisLabels } from '../axisLabels';

const WEEK = ['F', 'S', 'S', 'M', 'T', 'W', 'T'];
const WEEK_SHORT = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

describe('layoutAxisLabels', () => {
  it('returns nothing before the axis has been measured', () => {
    expect(layoutAxisLabels(WEEK, 0, 10)).toEqual([]);
  });

  it('shows every single-letter weekday in a narrow panel', () => {
    // ~134pt is the plot width of one of five landscape panels on an iPad.
    expect(layoutAxisLabels(WEEK, 134, 10).map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('thins three-letter labels to an even stride when they would collide', () => {
    const shown = layoutAxisLabels(WEEK_SHORT, 134, 10).map((p) => p.index);
    expect(shown).toEqual([0, 2, 4, 6]);
  });

  it('never lets shown labels overlap', () => {
    const days = Array.from({ length: 30 }, (_, i) => String(i + 1));
    for (const width of [120, 200, 400, 800]) {
      const placements = layoutAxisLabels(days, width, 10);
      placements.slice(1).forEach((p, i) => {
        expect(p.left).toBeGreaterThanOrEqual(placements[i].left + placements[i].width - 0.5);
      });
    }
  });

  it('centres labels under their slot and clamps them inside the axis', () => {
    const edges = layoutAxisLabels(['1 Mar', '', '', '', '29 Mar'], 100, 10);
    expect(edges.map((p) => p.index)).toEqual([0, 4]);
    expect(edges[0].left).toBe(0);
    expect(edges[1].left + edges[1].width).toBeLessThanOrEqual(100);

    const roomy = layoutAxisLabels(WEEK, 700, 10);
    roomy.forEach((p) => expect(p.left + p.width / 2).toBeCloseTo((p.index + 0.5) * 100));
  });

  it('respects labels that were pre-blanked upstream', () => {
    const labels = Array.from({ length: 26 }, (_, i) => (i % 4 === 0 ? `${i}` : ''));
    const shown = layoutAxisLabels(labels, 800, 10).map((p) => p.index);
    expect(shown).toEqual([0, 4, 8, 12, 16, 20, 24]);
  });
});
