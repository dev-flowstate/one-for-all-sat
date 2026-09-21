import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DomainPicker } from '../components/setup/DomainPicker';
import { DifficultyPicker } from '../components/setup/DifficultyPicker';
import { RevealModePicker } from '../components/setup/RevealModePicker';
import { TimerModePicker } from '../components/setup/TimerModePicker';
import { useProgressStore } from '../store/useProgressStore';
import { useSessionStore } from '../store/useSessionStore';
import { getMainPool } from '../lib/pools';
import { DOMAINS } from '../data/taxonomy';
import type { Difficulty, Subject } from '../types/question';
import type { RevealMode, TimerMode, SessionConfig } from '../types/settings';

const DEFAULT_QUESTION_COUNT = 10;
const DEFAULT_COUNTDOWN_MINUTES = 20;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function SetupPage() {
  const { questions, progress, stats, isLoaded } = useProgressStore();
  const navigate = useNavigate();

  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([]);
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [revealMode, setRevealMode] = useState<RevealMode>('immediate');
  const [timerMode, setTimerMode] = useState<TimerMode>('none');
  const [countdownMinutes, setCountdownMinutes] = useState(DEFAULT_COUNTDOWN_MINUTES);

  const filteredPool = useMemo(() => {
    const mainPool = getMainPool(questions, progress);
    return mainPool.filter(
      (q) =>
        (selectedDomains.length === 0 || selectedDomains.includes(q.domain)) &&
        (selectedDifficulties.length === 0 || selectedDifficulties.includes(q.difficulty)),
    );
  }, [questions, progress, selectedDomains, selectedDifficulties]);

  const availableCount = filteredPool.length;

  // Keep the chosen question count valid as filters change the available pool size.
  useEffect(() => {
    setQuestionCount((prev) => (availableCount === 0 ? prev : Math.min(Math.max(prev, 1), availableCount)));
  }, [availableCount]);

  function toggleDomain(domainName: string) {
    setSelectedDomains((prev) =>
      prev.includes(domainName) ? prev.filter((d) => d !== domainName) : [...prev, domainName],
    );
  }

  function toggleDifficulty(difficulty: Difficulty) {
    setSelectedDifficulties((prev) =>
      prev.includes(difficulty) ? prev.filter((d) => d !== difficulty) : [...prev, difficulty],
    );
  }

  function handleQuestionCountChange(raw: string) {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    setQuestionCount(Math.min(Math.max(parsed, 1), Math.max(availableCount, 1)));
  }

  function handleStart() {
    if (availableCount === 0) return;

    const selectedDomainObjects = DOMAINS.filter((d) => selectedDomains.includes(d.name));
    const subjects: Subject[] =
      selectedDomains.length === 0
        ? ['math', 'reading-writing']
        : Array.from(new Set(selectedDomainObjects.map((d) => d.subject)));

    const config: SessionConfig = {
      subjects,
      domains: selectedDomains,
      skills: [],
      difficulties: selectedDifficulties,
      questionCount,
      revealMode,
      timerMode,
      countdownMinutes: timerMode === 'countdown' ? countdownMinutes : undefined,
    };

    const queue = shuffle(filteredPool).slice(0, questionCount);

    useSessionStore.getState().startSession(config, queue, stats.currentStreak);
    navigate('/run');
  }

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <Link
          to="/"
          className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mb-5 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">
          Set up a session
        </h1>
        <Card>
          <p className="text-sm text-ink-soft">Loading your question bank…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        to="/"
        className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
      >
        ← Home
      </Link>
      <h1 className="mb-5 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">
        Set up a session
      </h1>

      <div className="flex flex-col gap-4">
        <Card title="Subjects & domains">
          <DomainPicker selected={selectedDomains} onToggle={toggleDomain} />
        </Card>

        {/* Difficulty and count are small controls, so they share a row rather than each
            taking a full-width panel the same size as the domain list. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Difficulty">
            <DifficultyPicker selected={selectedDifficulties} onToggle={toggleDifficulty} />
          </Card>

          <Card title="How many">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={Math.max(availableCount, 1)}
                value={availableCount === 0 ? 0 : questionCount}
                disabled={availableCount === 0}
                onChange={(e) => handleQuestionCountChange(e.target.value)}
                aria-label="Number of questions"
                className="min-h-11 w-24 border-2 border-ink bg-paper px-3 py-2 text-lg font-bold tabular-nums disabled:opacity-40"
              />
              <span className="text-xs font-semibold tracking-tight text-ink-soft uppercase">
                max {availableCount}
              </span>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Reveal answers">
            <RevealModePicker value={revealMode} onChange={setRevealMode} />
          </Card>

          <Card title="Timer">
            <TimerModePicker
              mode={timerMode}
              onModeChange={setTimerMode}
              countdownMinutes={countdownMinutes}
              onCountdownMinutesChange={setCountdownMinutes}
            />
          </Card>
        </div>

        {/* The count and the start button are the payoff, so they're one block: the number
            you're about to practise, and the button that starts it. */}
        <div className="panel-raised mt-2">
          <div className="flex items-center gap-4 border-b-2 border-ink bg-merino-dark px-4 py-3">
            <span className="text-4xl leading-none font-bold tabular-nums sm:text-5xl">{availableCount}</span>
            <span className="text-xs font-semibold tracking-tight text-ink-soft uppercase">
              question{availableCount === 1 ? '' : 's'}
              <br />
              available
            </span>
          </div>
          <div className="p-4">
            {availableCount === 0 ? (
              <p className="border-2 border-ink bg-danger-bg px-3 py-2 text-sm text-danger">
                Nothing matches these filters. Widen your selection, or reset progress to bring
                answered questions back.
              </p>
            ) : (
              <Button
                variant="primary"
                className="w-full py-4 text-base sm:text-lg"
                onClick={handleStart}
              >
                Start practicing
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
