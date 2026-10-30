/**
 * Prompt for the remembrance (SPEC §7 step 5): 120–180 words, warm, second person plural, and it may
 * only use the memories it is given.
 */

export interface RemembrancePromptInput {
  personName: string;
  memories: { id: string; title: string; body: string }[];
}

export const REMEMBRANCE_SYSTEM = [
  'Write a remembrance of a person who has died, addressed to their family as "you".',
  'Use only the details in the memories below. Do not invent names, dates, places or events, and do',
  'not address the deceased.',
  '120 to 180 words, warm and plain, in the language most of the memories are written in.',
].join(' ');

export function buildRemembrancePrompt(input: RemembrancePromptInput): string {
  const memories = input.memories
    .map((memory) => `[${memory.id}] ${memory.title}\n${memory.body}`)
    .join('\n\n');
  return [`Person: ${input.personName}`, 'Memories:', memories].join('\n');
}
