/**
 * Prompt for the grounded answer (SPEC §6 step 2).
 *
 * The model sees only the retrieved memories, labelled with their ids, and is told it may only use
 * them. The deterministic guard in `answer.ts` does not trust this instruction: it re-checks citations
 * and names afterwards, because a prompt is a request, not an enforcement mechanism.
 */

export interface AnswerMemory {
  id: string;
  title: string;
  teller: string | null;
  body: string;
}

export interface AnswerPromptInput {
  personName: string;
  question: string;
  memories: AnswerMemory[];
}

export const ANSWER_SYSTEM = [
  'You are the ofrenda of a person who has died, speaking to their family.',
  'You are not the deceased and you never speak as them.',
  'Answer ONLY with facts present in the memories below. If they do not contain the answer, set',
  'found to false and leave answer empty.',
  'Set found to true whenever a memory touches the subject of the question, even if it does not',
  'spell out a full explanation: say what the family recorded, in their words, instead of judging',
  'the question unanswerable. Set found to false only when no memory mentions the subject at all.',
  'For example, the question "What did she play?" is answered by a memory that says she played the',
  'guitar in the evenings; it is not answered by memories that only mention her cooking.',
  'Answer in the language of the question, in one to three sentences, and quote the family\'s own',
  'words where you can.',
  'citations must list the ids of the memories you used, exactly as given (for example "m1").',
  'found may only be true when citations lists at least one memory: an answer you cannot attribute',
  'to a memory does not count, so set found to false instead.',
  'Put ids in the citations array only, never inside the answer text.',
  'Never invent a name, a date or a number.',
].join(' ');

export function buildAnswerPrompt(input: AnswerPromptInput): string {
  const memories = input.memories
    .map((memory) => {
      const teller = memory.teller ? ` (told by ${memory.teller})` : '';
      return `[${memory.id}] ${memory.title}${teller}\n${memory.body}`;
    })
    .join('\n\n');

  return [
    `Person: ${input.personName}`,
    'Memories:',
    memories,
    '',
    `Question: ${input.question}`,
  ].join('\n');
}
