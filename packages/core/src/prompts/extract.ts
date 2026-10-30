/**
 * Prompt for turning one family story into altar items (SPEC §7 step 4).
 *
 * The model gets the story and nothing else: no web, no prior stories. What it returns is filtered by
 * the zod schema in `ingest/extract.ts`, then upserted by normalised name.
 */

export interface ExtractPromptInput {
  personName: string;
  title: string;
  body: string;
  lang: 'es' | 'en' | 'mixed';
}

export const EXTRACT_SYSTEM = [
  'You read one family story about a person who has died and list what belongs on their ofrenda:',
  'food they cooked or loved, songs, places, sayings, rituals, photographs, dates.',
  'Only list things the story actually mentions. Never guess, never generalise, never add a detail',
  'that is not in the text. A story with no altar item yields an empty list.',
  'Write each item name the way the family wrote it, in the story\'s language.',
  'The note is one short clause from the story that explains the item, or an empty string.',
].join(' ');

export function buildExtractPrompt(input: ExtractPromptInput): string {
  return [
    `Person: ${input.personName}`,
    `Story title: ${input.title}`,
    `Story language: ${input.lang}`,
    'Story:',
    input.body,
    '',
    'List the altar items this story mentions. kind must be one of: food, song, place, saying, ritual, photo, date.',
  ].join('\n');
}
