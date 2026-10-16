import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listDoodles, saveDoodle, type SavedDoodle } from '../lib/doodles';
import { useLoadedQuestions } from '../lib/useLoadedQuestions';
import { useVocabStore } from '../store/useVocabStore';
import { useProgressStore } from '../store/useProgressStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { QuestionLayout } from '../components/test-runner/QuestionLayout';
import { McqChoices } from '../components/test-runner/McqChoices';
import { SprInput } from '../components/test-runner/SprInput';
import { AnswerFeedback } from '../components/test-runner/AnswerFeedback';
import { QuestionPlaceholder } from '../components/review/QuestionPlaceholder';
import { Flashcard } from '../components/vocab/Flashcard';
import { BOOKS, getReadingProgress, setReadingProgress, type BookId } from '../lib/reading';

type Kind = 'q' | 'vocab' | 'book';

const KIND_LABELS: Record<Kind, string> = { q: 'Questions', vocab: 'Words', book: 'Book' };

function kindOf(id: string): Kind | null {
  const prefix = id.split(':')[0];
  return prefix === 'q' || prefix === 'vocab' || prefix === 'book' ? prefix : null;
}

function when(savedAt?: string): string {
  return savedAt
    ? new Date(savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Saved earlier';
}

/**
 * Every doodle saved: over questions, on a word's meaning, and in the book. Each is shown on
 * what it was drawn on, laid out as it was drawn, so it can be looked at, carried on, or deleted.
 */
export function DoodlesPage() {
  const [doodles, setDoodles] = useState<SavedDoodle[]>(() => listDoodles());
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const refresh = () => setDoodles(listDoodles());

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { q: 0, vocab: 0, book: 0 };
    for (const d of doodles) {
      const k = kindOf(d.id);
      if (k) c[k] += 1;
    }
    return c;
  }, [doodles]);
  const shown = doodles.filter((d) => kindOf(d.id) && (kind === 'all' || kindOf(d.id) === kind));

  const questionIds = useMemo(
    () => doodles.filter((d) => kindOf(d.id) === 'q').map((d) => d.id.slice(2)),
    [doodles],
  );
  const { loaded } = useLoadedQuestions(questionIds);
  const progress = useProgressStore((s) => s.progress);

  const cards = useVocabStore((s) => s.cards);
  const cardsLoaded = useVocabStore((s) => s.cardsLoaded);
  const needWords = counts.vocab > 0;
  useEffect(() => {
    if (needWords && !cardsLoaded) void useVocabStore.getState().ensureCards();
  }, [needWords, cardsLoaded]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  function remove(id: string) {
    if (!window.confirm('Delete this doodle? This cannot be undone.')) return;
    saveDoodle(id, []);
    refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Saved doodles</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Everything you&apos;ve drawn and saved, on the question, word or page it belongs to. Newest first.
          Turn on Annotate to keep drawing on one.
        </p>
      </header>

      {doodles.length === 0 ? (
        <div className="panel px-4 py-12 text-center">
          <p className="text-sm font-semibold tracking-tight uppercase">No doodles yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            On any question, word meaning or book page, press Annotate, draw, then Save doodle. It will show up
            here.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Show">
            {(['all', 'q', 'vocab', 'book'] as const).map((k) => {
              const n = k === 'all' ? doodles.length : counts[k];
              if (k !== 'all' && n === 0) return null;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={`min-h-10 border-2 border-ink px-3 font-mono text-xs font-bold uppercase ${
                    kind === k ? 'bg-venice-blue text-merino' : 'bg-paper hover:bg-merino-dark'
                  }`}
                >
                  {k === 'all' ? 'All' : KIND_LABELS[k]} [{n}]
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-6">
            {shown.map((d) => {
              const k = kindOf(d.id)!;
              const del = (
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="border-2 border-merino px-2 py-0.5 font-mono text-[10px] font-bold text-merino uppercase hover:bg-merino hover:text-venice-blue"
                >
                  Delete
                </button>
              );

              if (k === 'q') {
                const question = loaded[d.id.slice(2)];
                if (!question) return <QuestionPlaceholder key={d.id} />;
                const outcome = progress[question.id]?.lastOutcome;
                return (
                  <Card
                    key={d.id}
                    title={`Question · ${when(d.savedAt)}`}
                    titleRight={del}
                    className="bb-question-card"
                  >
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Badge>{question.domain}</Badge>
                      <Badge>{question.skill}</Badge>
                      <Badge>{question.difficulty}</Badge>
                    </div>
                    {/* Laid out as practice shows it once answered, explanation and all, so a
                        drawing made over any of it sits where it was drawn. */}
                    <QuestionLayout question={question}>
                      {question.choices ? (
                        <McqChoices
                          choices={question.choices}
                          crossedIds={[]}
                          submitted
                          revealMode="end"
                          onChoiceClick={() => {}}
                        />
                      ) : (
                        <SprInput value="" onChange={() => {}} onSubmit={() => {}} submitted />
                      )}
                      {outcome && (
                        <div className="mt-5">
                          <AnswerFeedback
                            outcome={outcome}
                            explanation={question.explanation}
                            questionId={question.id}
                            celebrate={false}
                          />
                        </div>
                      )}
                    </QuestionLayout>
                  </Card>
                );
              }

              if (k === 'vocab') {
                const card = cardById.get(d.id.slice('vocab:'.length));
                return (
                  <Card key={d.id} title={`Word · ${when(d.savedAt)}`} titleRight={del}>
                    {/* The drill's width, so the drawing sits where it was drawn. */}
                    <div className="mx-auto max-w-2xl">
                      {card ? <Flashcard card={card} isFlipped /> : <p className="text-sm text-ink-soft">Loading…</p>}
                    </div>
                  </Card>
                );
              }

              const [, bookId, chapter] = d.id.split(':');
              const book = BOOKS.find((b) => b.id === bookId);
              return (
                <Card key={d.id} title={`Book · ${when(d.savedAt)}`} titleRight={del}>
                  <p className="mb-3 text-sm">
                    <span className="font-semibold">{book?.title ?? bookId}</span>, chapter {Number(chapter) + 1}
                  </p>
                  <OpenChapter bookId={bookId as BookId} chapter={Number(chapter)} />
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Opens the reader at the chapter the doodle is in. */
function OpenChapter({ bookId, chapter }: { bookId: BookId; chapter: number }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        // Only where the reader opens changes; how far the book has been read stays as it was.
        const saved = getReadingProgress(bookId) ?? { read: 0, furthestChapter: chapter, furthestParagraph: 0 };
        setReadingProgress(bookId, { ...saved, chapter, paragraph: 0 });
        navigate('/read');
      }}
      className="press border-2 border-ink bg-venice-blue px-3 py-2 font-mono text-xs font-bold text-merino uppercase shadow-[3px_3px_0_var(--color-ink)]"
    >
      Open in the reader
    </button>
  );
}

