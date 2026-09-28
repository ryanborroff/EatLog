import { hasCorrectionCue } from '../../utils/correctionCue';

describe('hasCorrectionCue', () => {
  it.each([
    'actually it was tuna',
    'add mayonnaise',
    'remove the crisps',
    'change the yoghurt to Greek yoghurt',
    'that was lunch, not dinner',
    'make that two eggs',
    'it wasn’t white bread',
    'Take   off the cheese',
  ])('treats "%s" as a correction', (text) => {
    expect(hasCorrectionCue(text)).toBe(true);
  });

  it.each([
    'vercelli noodles',
    'vermicelli noodles one breast of chicken one spring onion',
    'two cups of black coffee',
    'coconut water',
    'a bowl of porridge with banana',
    // Cue words inside other words don't count.
    'a knotted pretzel',
    'padded thai noodles',
  ])('treats "%s" as a new entry', (text) => {
    expect(hasCorrectionCue(text)).toBe(false);
  });
});
