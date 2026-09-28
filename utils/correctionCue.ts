// Whether an utterance is worded like a correction to the last meal ("actually
// it was tuna", "remove the crisps", "make that two"). The recent meal is only
// sent to the parser when it is, so a plain food name — including a misheard
// one — can never be read as a correction and overwrite an earlier entry.
// False positives are harmless: the parser still decides from the wording.

const CORRECTION_CUES = [
  'actually',
  'instead',
  'change',
  'changed',
  'replace',
  'swap',
  'remove',
  'delete',
  'take off',
  'take out',
  'scrap',
  'cancel',
  'add',
  'forgot',
  'make that',
  'make it',
  'not',
  "wasn't",
  "didn't",
  'wrong',
  'correct',
  'correction',
  'update',
  'only had',
];

const CUE_PATTERN = new RegExp(`\\b(${CORRECTION_CUES.map((cue) => cue.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');

export const hasCorrectionCue = (transcript: string): boolean =>
  // Normalize curly apostrophes from iOS dictation/keyboards ("wasn’t").
  CUE_PATTERN.test(transcript.replace(/’/g, "'"));
