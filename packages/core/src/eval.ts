/**
 * Eval runner for the grounded answer (SPEC §6): `pnpm --filter @ofrenda/core eval`.
 *
 * Reads `seed/abuela-rosa/eval.json` (12 questions, 4 unanswerable), asks the ofrenda each one, and
 * prints a table plus the pass bar. Pass means: ≥10/12 correct `found`, 100% of citations are real
 * memories, and 0 invented names or numbers. Exits non-zero when the bar is missed, so CI can use it.
 *
 * Run it against both models to compare:
 *   OFRENDA_MODEL=gemma3:4b pnpm --filter @ofrenda/core eval
 *   OFRENDA_MODEL=gemma3:1b pnpm --filter @ofrenda/core eval
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { answerQuestion, inventedTerms } from './answer.js';
import { getConfig } from './config.js';
import { closePool, getPerson, listMemories } from './db/queries.js';

const EVAL_FILE = new URL('../../../seed/abuela-rosa/eval.json', import.meta.url);

interface EvalQuestion {
  q: string;
  lang: 'en' | 'es';
  found: boolean;
  expect: string[];
}

interface EvalFile {
  questions: EvalQuestion[];
}

export interface EvalRow {
  question: string;
  expectedFound: boolean;
  found: boolean;
  foundCorrect: boolean;
  cited: string[];
  expectedCited: boolean;
  citationsValid: boolean;
  invented: string[];
  mode: string;
  ms: number;
  /** Set when the answer pipeline threw for this question. */
  error?: string;
}

export interface EvalResult {
  rows: EvalRow[];
  total: number;
  foundCorrect: number;
  citationsValid: boolean;
  inventedTotal: number;
  passed: boolean;
  model: string;
}

/** Minimum correct `found` decisions out of 12 (SPEC §6). */
export const PASS_FOUND_MIN = 10;

export async function runEval(personId = 'rosa-mendez'): Promise<EvalResult> {
  const { questions } = JSON.parse(await readFile(fileURLToPath(EVAL_FILE), 'utf8')) as EvalFile;
  const memories = await listMemories(personId);
  const known = new Set(memories.map((memory) => memory.id));
  if (memories.length === 0) {
    throw new Error(`No memories for ${personId}. Run \`pnpm --filter @ofrenda/core seed\` first.`);
  }

  const rows: EvalRow[] = [];
  const person = await getPerson(personId);
  for (const question of questions) {
    const started = Date.now();
    let judged;
    try {
      judged = await answerQuestion({
        personId,
        question: question.q,
        ...(person ? { personName: person.name } : {}),
      });
    } catch (error) {
      // One flaky structured-output call must not hide the other eleven rows.
      const message = error instanceof Error ? error.message : String(error);
      rows.push({
        question: question.q,
        expectedFound: question.found,
        found: false,
        foundCorrect: false,
        cited: [],
        expectedCited: false,
        citationsValid: true,
        invented: [],
        mode: 'error',
        ms: Date.now() - started,
        error: message,
      });
      continue;
    }
    const answer = judged;
    const ms = Date.now() - started;

    const cited = answer.citations.map((citation) => citation.id);
    const bodyById = new Map(memories.map((memory) => [memory.id, memory.body]));
    const invented = inventedTerms(
      answer.answer,
      cited.map((id) => bodyById.get(id) ?? ''),
      person ? [person.name] : [],
    );

    rows.push({
      question: question.q,
      expectedFound: question.found,
      found: answer.found,
      foundCorrect: answer.found === question.found,
      cited,
      expectedCited: question.expect.length === 0 || cited.some((id) => question.expect.includes(id)),
      citationsValid: cited.every((id) => known.has(id)),
      invented,
      mode: answer.mode,
      ms,
    });
  }

  const foundCorrect = rows.filter((row) => row.foundCorrect).length;
  const citationsValid = rows.every((row) => row.citationsValid);
  const inventedTotal = rows.reduce((sum, row) => sum + row.invented.length, 0);

  return {
    rows,
    total: rows.length,
    foundCorrect,
    citationsValid,
    inventedTotal,
    passed: foundCorrect >= PASS_FOUND_MIN && citationsValid && inventedTotal === 0,
    model: getConfig().model,
  };
}

function printTable(result: EvalResult): void {
  console.log(`\nOfrenda grounded-answer eval — model ${result.model}`);
  console.log('─'.repeat(96));
  console.log(
    `${'question'.padEnd(44)} ${'want'.padEnd(5)} ${'got'.padEnd(5)} ${'cited'.padEnd(14)} ${'mode'.padEnd(10)} ms`,
  );
  console.log('─'.repeat(96));
  for (const row of result.rows) {
    const question = row.question.length > 43 ? `${row.question.slice(0, 40)}...` : row.question;
    const want = row.expectedFound ? 'yes' : 'no';
    const got = row.found ? 'yes' : 'no';
    const mark = row.foundCorrect ? ' ' : '!';
    const cited = (row.cited.join(',') || '-').padEnd(14);
    console.log(
      `${mark}${question.padEnd(43)} ${want.padEnd(5)} ${got.padEnd(5)} ${cited} ${row.mode.padEnd(10)} ${row.ms}`,
    );
  }
  console.log('─'.repeat(96));
  const flagged = result.rows.filter((row) => row.invented.length > 0);
  if (flagged.length > 0) {
    console.log(
      `invented: ${flagged.map((row) => `${row.cited.join(',')}: ${row.invented.join(', ')}`).join(' | ')}`,
    );
  }
  const errored = result.rows.filter((row) => row.error);
  if (errored.length > 0) {
    console.log(`errors: ${errored.map((row) => `${row.question}: ${row.error}`).join(' | ')}`);
  }
}

/** Print the table and the pass bar, and return the process exit code. */
export function report(result: EvalResult): number {
  printTable(result);
  console.log(
    `found correct: ${result.foundCorrect}/${result.total} (bar: >= ${PASS_FOUND_MIN}/${result.total})`,
  );
  console.log(`citations valid: ${result.citationsValid ? 'yes' : 'NO'} (bar: 100%)`);
  console.log(`invented names/numbers: ${result.inventedTotal} (bar: 0)`);
  const slowest = [...result.rows].sort((a, b) => b.ms - a.ms)[0];
  if (slowest) console.log(`slowest question: ${slowest.ms} ms (${slowest.mode})`);
  console.log(`\n${result.passed ? 'PASS' : 'FAIL'} — SPEC §6 bar`);
  return result.passed ? 0 : 1;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && fileURLToPath(import.meta.url) === entry;
}

if (isMain()) {
  try {
    process.exitCode = report(await runEval());
  } catch (error) {
    console.error(`eval failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
