/**
 * Step-by-step solutions, written for the quickest route to each answer (often Desmos for
 * math) rather than the College Board explanation's. They live in public/solutions.json,
 * fetched the first time someone opens one.
 */
export interface SolutionStep {
  /** Plain text; math inside \( \), as in the questions. */
  text: string;
  /** What to type into Desmos, for a step done there. */
  desmos?: string;
}

export interface Solution {
  method: 'desmos' | 'algebra' | 'reading';
  steps: SolutionStep[];
}

let loading: Promise<Record<string, Solution>> | null = null;

export function fetchSolutions(): Promise<Record<string, Solution>> {
  loading ??= fetch(`${import.meta.env.BASE_URL}solutions.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`solutions.json: ${r.status}`);
      return r.json() as Promise<{ solutions: Record<string, Solution> }>;
    })
    .then((file) => file.solutions);
  // A failed download is tried again next time.
  loading.catch(() => (loading = null));
  return loading;
}
