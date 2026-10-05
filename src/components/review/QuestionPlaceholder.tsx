/** Holds a question's place in a list while it loads, about as tall as a short question, so
 *  the list doesn't jump when it arrives. */
export function QuestionPlaceholder() {
  return (
    <div className="panel flex min-h-48 items-center justify-center px-4 py-6 font-mono text-xs text-ink-soft uppercase">
      Loading…
    </div>
  );
}
