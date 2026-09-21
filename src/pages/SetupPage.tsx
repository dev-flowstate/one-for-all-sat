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
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/" className="mb-4 inline-block text-sm text-venice-blue hover:underline">
          ← Home
        </Link>
        <h1 className="mb-4 text-2xl font-bold text-venice-blue-dark">Set up a practice session</h1>
        <Card>
          <p className="text-sm text-venice-blue-dark/70">Loading your question bank…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-venice-blue hover:underline">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-venice-blue-dark">Set up a practice session</h1>

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-3 text-base font-semibold text-venice-blue-dark">Subjects & domains</h2>
          <DomainPicker selected={selectedDomains} onToggle={toggleDomain} />
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-venice-blue-dark">Difficulty</h2>
          <DifficultyPicker selected={selectedDifficulties} onToggle={toggleDifficulty} />
        </Card>

        <Card className="text-center">
          <p className="text-2xl font-bold text-venice-blue">{availableCount}</p>
          <p className="text-sm text-venice-blue-dark/70">question{availableCount === 1 ? '' : 's'} available</p>
          {availableCount === 0 && (
            <p className="mt-2 text-xs text-danger">
              No unattempted questions match these filters. Try widening your selection.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-venice-blue-dark">How many questions?</h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={Math.max(availableCount, 1)}
              value={availableCount === 0 ? 0 : questionCount}
              disabled={availableCount === 0}
              onChange={(e) => handleQuestionCountChange(e.target.value)}
              aria-label="Number of questions"
              className="w-24 rounded-lg border border-rock-blue/40 bg-white/70 px-3 py-2 text-sm text-venice-blue-dark disabled:opacity-50"
            />
            <span className="text-xs text-venice-blue-dark/60">max {availableCount}</span>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-venice-blue-dark">Reveal answers</h2>
          <RevealModePicker value={revealMode} onChange={setRevealMode} />
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-venice-blue-dark">Timer</h2>
          <TimerModePicker
            mode={timerMode}
            onModeChange={setTimerMode}
            countdownMinutes={countdownMinutes}
            onCountdownMinutesChange={setCountdownMinutes}
          />
        </Card>

        <Button variant="primary" className="w-full py-3.5 text-base" disabled={availableCount === 0} onClick={handleStart}>
          Start Practicing
        </Button>
      </div>
    </div>
  );
}
