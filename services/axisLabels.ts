export interface AxisLabelPlacement {
  index: number;
  label: string;
  /** Left edge of the label's box, in points from the start of the axis. */
  left: number;
  /** Box width; the text is centred inside it. */
  width: number;
}

// Rough advance width of one character as a fraction of the font size. Errs wide
// so labels thin out a little early rather than collide.
const CHAR_WIDTH_EM = 0.62;
// Minimum breathing room between neighbouring labels.
const LABEL_GAP = 4;

/**
 * Picks which axis labels to show and where, given the measured axis width.
 * Each shown label is centred under its bar (clamped so it can't spill off either
 * end), and labels are thinned to a fixed stride wide enough that the longest one
 * fits — so the axis stays evenly spaced however narrow the panel gets.
 */
export const layoutAxisLabels = (
  labels: string[],
  axisWidth: number,
  fontSize: number
): AxisLabelPlacement[] => {
  if (labels.length === 0 || axisWidth <= 0) return [];

  const slotWidth = axisWidth / labels.length;
  const longest = Math.max(...labels.map((label) => label.length));
  const textWidth = Math.ceil(longest * fontSize * CHAR_WIDTH_EM);
  const stride = Math.max(1, Math.ceil((textWidth + LABEL_GAP) / slotWidth));
  const boxWidth = Math.min(Math.max(textWidth, slotWidth), axisWidth);

  const placements: AxisLabelPlacement[] = [];
  let lastShown = -Infinity;
  let lastRight = -Infinity;
  labels.forEach((label, index) => {
    if (!label || index - lastShown < stride) return;
    const centre = (index + 0.5) * slotWidth;
    const left = Math.min(Math.max(centre - boxWidth / 2, 0), axisWidth - boxWidth);
    // Clamping an end label inwards can push it into its neighbour; drop it instead.
    if (left < lastRight - 0.5) return;
    lastShown = index;
    lastRight = left + boxWidth;
    placements.push({ index, label, left, width: boxWidth });
  });
  return placements;
};
