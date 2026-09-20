declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (element: HTMLElement, options?: Record<string, unknown>) => DesmosCalculator;
    };
  }
}

export interface DesmosCalculator {
  destroy: () => void;
  setBlank?: () => void;
}

export type DesmosLoadFailureReason = 'NO_API_KEY' | 'SCRIPT_LOAD_FAILED';

export class DesmosLoadError extends Error {
  reason: DesmosLoadFailureReason;
  constructor(reason: DesmosLoadFailureReason) {
    super(reason);
    this.reason = reason;
  }
}

let loadPromise: Promise<void> | null = null;

/** Lazily injects the Desmos API script — only called when the calculator panel is first opened. */
export function loadDesmosScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Desmos) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const apiKey = import.meta.env.VITE_DESMOS_API_KEY as string | undefined;
  if (!apiKey) {
    return Promise.reject(new DesmosLoadError('NO_API_KEY'));
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new DesmosLoadError('SCRIPT_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
