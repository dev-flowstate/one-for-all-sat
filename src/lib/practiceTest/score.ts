import type { Difficulty, Question } from '../../types/question';
import type { SessionAnswer } from '../../types/progress';
import type { ActiveTest, CompletedTest, DomainTally, TestResponse } from '../../types/practiceTest';
import { checkMcqAnswer, checkSprAnswer } from '../scoring/answerChecking';
import { pointsForAnswer } from '../scoring/points';
import { SECTIONS } from './buildTest';

/** Harder questions carry more of the score, as they do on the SAT. */
const WEIGHT: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };

/**
 * A section's score on the SAT scale: 200 with nothing right, 800 with everything right, and
 * always a multiple of 10. Each question counts by its difficulty weight.
 */
export function sectionScore(graded: { question: Question; correct: boolean }[]): number {
  const possible = graded.reduce((sum, g) => sum + WEIGHT[g.question.difficulty], 0);
  if (possible === 0) return 200;
  const earned = graded.reduce((sum, g) => sum + (g.correct ? WEIGHT[g.question.difficulty] : 0), 0);
  return 200 + Math.round((60 * earned) / possible) * 10;
}

/** Whether an entered answer is right. A blank never is. */
export function isCorrect(question: Question, response: TestResponse | undefined): boolean {
  return question.type === 'mcq'
    ? checkMcqAnswer(response?.choice, question.correctChoice)
    : checkSprAnswer(response?.text ?? '', question.acceptableAnswers ?? []);
}

export function gradeTest(
  test: ActiveTest,
  questionsById: Map<string, Question>,
  startingStreak: number,
): CompletedTest {
  const answers: SessionAnswer[] = [];
  const graded: { question: Question; correct: boolean }[] = [];
  let streak = startingStreak;

  for (const module of test.modules) {
    for (const id of module.questionIds) {
      const question = questionsById.get(id);
      if (!question) continue;
      const response = test.responses[id];
      const correct = isCorrect(question, response);
      answers.push({
        questionId: id,
        outcome: correct ? 'correct' : 'incorrect',
        selectedChoice: response?.choice,
        submittedAnswer: response?.text,
        pointsEarned: pointsForAnswer(question.difficulty, correct, streak),
      });
      streak = correct ? streak + 1 : 0;
      graded.push({ question, correct });
    }
  }

  const domains: DomainTally[] = [];
  for (const section of SECTIONS) {
    for (const domain of Object.keys(section.modules[0])) {
      const inDomain = graded.filter((g) => g.question.subject === section.subject && g.question.domain === domain);
      domains.push({
        subject: section.subject,
        domain,
        total: inDomain.length,
        wrong: inDomain.filter((g) => !g.correct).length,
      });
    }
  }

  // A section the test didn't include has no score, rather than the 200 an empty one would get.
  const scoreFor = (subject: string) => {
    const inSection = graded.filter((g) => g.question.subject === subject);
    return inSection.length > 0 ? sectionScore(inSection) : null;
  };
  const readingWriting = scoreFor('reading-writing');
  const math = scoreFor('math');
  return {
    number: test.number,
    name: test.name,
    presetId: test.presetId,
    routedEasier: test.routing?.map((r) => r.routedEasier ?? false),
    createdAt: test.createdAt,
    completedAt: new Date().toISOString(),
    timed: test.timed,
    readingWriting,
    math,
    total: readingWriting !== null && math !== null ? readingWriting + math : null,
    answers,
    domains,
  };
}
