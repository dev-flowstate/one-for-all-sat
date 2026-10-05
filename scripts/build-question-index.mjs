// Writes public/question-index.json: each question's id and category, from the full bank. The
// app reads this small file on startup to tell whether its stored copy of the bank is current,
// and only downloads the full bank (about 21 MB, mostly images) when it isn't.
import { readFileSync, writeFileSync } from 'node:fs';

const bank = JSON.parse(readFileSync('public/question-bank.json', 'utf8'));
const index = {
  revision: bank.revision ?? 0,
  questions: bank.questions.map((q) => ({
    id: q.id,
    subject: q.subject,
    domain: q.domain,
    skill: q.skill,
    difficulty: q.difficulty,
  })),
};
writeFileSync('public/question-index.json', JSON.stringify(index));
console.log(`question-index.json: ${index.questions.length} questions, revision ${index.revision}`);
