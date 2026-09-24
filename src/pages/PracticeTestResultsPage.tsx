import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { Question } from '../types/question';
import { usePracticeTestStore } from '../store/usePracticeTestStore';
import { useProgressStore } from '../store/useProgressStore';
import { SECTIONS } from '../lib/practiceTest/buildTest';
import { testName } from '../lib/practiceTest/format';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { QuestionReviewCard } from '../components/review/QuestionReviewCard';
import { AnswerComparison } from '../components/results/AnswerComparison';

/** A finished practice test: its scores, where the misses were, and every missed question. */
export function PracticeTestResultsPage() {
  const { number } = useParams();
  const result = usePracticeTestStore((s) => s.history.find((t) => String(t.number) === number));
  const questions = useProgressStore((s) => s.questions);
  const questionsById = useMemo(() => new Map<string, Question>(questions.map((q) => [q.id, q])), [questions]);

  if (!result) return <Navigate to="/tests" replace />;

  const scores = { 'reading-writing': result.readingWriting, math: result.math };
  // A named test may cover one section only; that section's score is then the headline.
  const sections = SECTIONS.filter((s) => scores[s.subject] !== null);
  const only = sections.length === 1 ? sections[0] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="panel-raised">
        <div className="flex items-center gap-2 border-b-2 border-ink bg-ink px-3 py-1.5">
          <span className="flex-1 truncate text-[11px] font-semibold tracking-tight text-merino uppercase">
            {testName(result)}
            {!result.timed && ' · Untimed'}
          </span>
          <span className="text-[11px] font-semibold tracking-tight text-merino uppercase">
            {new Date(result.completedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="border-b-2 border-ink px-4 py-8 text-center sm:py-12">
          <p className="text-[11px] font-semibold tracking-tight text-ink-soft uppercase">
            {only ? `${only.title} score` : 'Total score'}
          </p>
          <p className="mt-2 flex items-baseline justify-center gap-2 leading-none">
            <span className="text-6xl font-bold tracking-tight tabular-nums sm:text-8xl">
              {only ? scores[only.subject] : result.total}
            </span>
            <span className="text-2xl font-bold tracking-tight text-ink-soft tabular-nums sm:text-4xl">
              / {only ? 800 : 1600}
            </span>
          </p>
        </div>

        {!only && (
          <dl className="grid grid-cols-2 gap-[2px] bg-ink">
            {sections.map((section) => (
              <div key={section.subject} className="bg-merino-dark px-3 py-3 text-center">
                <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">{section.title}</dt>
                <dd className="mt-1 text-3xl font-bold tabular-nums">
                  {scores[section.subject]}
                  <span className="text-base text-ink-soft"> / 800</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link to="/tests" className="block">
          <Button className="w-full">Practice tests</Button>
        </Link>
        <Link to="/" className="block">
          <Button variant="ghost" className="w-full">
            Back to home
          </Button>
        </Link>
      </div>

      <section className="mt-8 flex flex-col gap-4">
        <h2 className="border-2 border-ink bg-ink px-3 py-1.5 text-xs font-semibold tracking-tight text-merino uppercase">
          Where you lost points
        </h2>
        {sections.map((section) => {
          const rows = result.domains.filter((d) => d.subject === section.subject);
          const total = rows.reduce((sum, d) => sum + d.total, 0);
          const wrong = rows.reduce((sum, d) => sum + d.wrong, 0);
          return (
            <Card key={section.subject} title={section.title} titleRight={
              <span className="font-mono text-xs font-semibold text-merino tabular-nums">
                {wrong} wrong of {total}
              </span>
            }>
              <table className="w-full text-left text-sm">
                <thead className="font-mono text-[11px] tracking-tight text-ink-soft uppercase">
                  <tr>
                    <th className="py-1 font-semibold">Domain</th>
                    <th className="py-1 text-right font-semibold">Wrong</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((d) => (
                    <tr key={d.domain} className="border-t-2 border-merino-dark">
                      <th className="py-2 pr-3 font-normal">{d.domain}</th>
                      <td className={`py-2 text-right font-semibold ${d.wrong > 0 ? 'text-danger' : 'text-success'}`}>
                        {d.wrong} of {d.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </section>

      {sections.map((section) => {
        const wrong = result.answers.filter(
          (a) => a.outcome === 'incorrect' && questionsById.get(a.questionId)?.subject === section.subject,
        );
        return (
          <section key={section.subject} className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-2 border-2 border-ink bg-ink px-3 py-1.5">
              <h2 className="text-xs font-semibold tracking-tight text-merino uppercase">
                Wrong in {section.title}
              </h2>
              <span className="text-xs font-semibold text-merino tabular-nums">[{wrong.length}]</span>
            </div>
            {wrong.length === 0 ? (
              <p className="panel px-4 py-6 text-center text-sm text-ink-soft">Nothing wrong in this section.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {wrong.map((answer) => {
                  const question = questionsById.get(answer.questionId);
                  if (!question) return null;
                  return (
                    <QuestionReviewCard
                      key={answer.questionId}
                      question={question}
                      answerSummary={<AnswerComparison question={question} answer={answer} />}
                    />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
