import { useEffect, useRef, useState } from 'react';
import { useAccountStore } from '../../store/useAccountStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { satStart, upcomingSatDates } from '../../data/satDates';
import { Button } from '../ui/Button';

/** "Not now" holds for the rest of the visit; the question comes back on the next one. */
const ASKED_KEY = 'ofa-sat:sat-date-asked';

function askedThisVisit(): boolean {
  try {
    return sessionStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Asks a signed-in student when they're sitting the SAT, so the home screen can count down to
 * it. Waits for their account to finish loading, since a date picked on another device comes
 * with it, and asks again once the chosen date has passed.
 */
export function SatDatePrompt() {
  const signedIn = useAccountStore((s) => !!s.user && s.status === 'synced');
  const satDate = useSettingsStore((s) => s.profile?.satDate);
  const setSatDate = useSettingsStore((s) => s.setSatDate);
  const [dismissed, setDismissed] = useState(askedThisVisit);
  const ref = useRef<HTMLDialogElement>(null);

  const options = upcomingSatDates();
  const needsDate = !satDate || satStart(satDate) <= new Date();
  const open = signedIn && needsDate && options.length > 0 && !dismissed;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(ASKED_KEY, '1');
    } catch {
      // Without storage it's asked again on the next page load.
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="sat-date-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="panel-raised m-auto w-[min(28rem,calc(100vw-2rem))] p-0 text-ink backdrop:bg-ink/50"
    >
      <h2
        id="sat-date-title"
        className="bb-cardbar border-b-2 border-ink bg-venice-blue px-4 py-2 font-mono text-sm font-bold tracking-tight text-merino uppercase"
      >
        When is your SAT?
      </h2>
      <div className="flex flex-col gap-3 px-4 py-4 text-sm">
        <p>Pick your test date and the home screen will count down to it.</p>
        {options.map((option) => (
          <Button
            key={option.date}
            variant="secondary"
            className="w-full py-3 text-base"
            onClick={() => setSatDate(option.date)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div className="flex justify-end border-t-2 border-ink bg-merino-dark px-4 py-3">
        <Button variant="ghost" onClick={close}>
          Not now
        </Button>
      </div>
    </dialog>
  );
}
