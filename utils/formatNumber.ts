/**
 * Rounds to 1 decimal and drops it when whole (45.3, not 45.300000000000004;
 * 26, not 26.0) — summed floats otherwise leak binary rounding noise straight
 * into the UI.
 */
export const formatAmount = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
};
