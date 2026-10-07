import type { BankJob } from './bankWorker';
import * as bankJobs from './bankJobs';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./bankWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; value?: unknown; error?: string }>) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    if (e.data.ok) job.resolve(e.data.value);
    else job.reject(new Error(e.data.error));
  };
  worker.onerror = () => {
    // A worker that fails to start: the jobs run here instead.
    for (const job of pending.values()) job.reject(new Error('worker failed'));
    pending.clear();
    worker = null;
  };
  return worker;
}

type Result<J extends BankJob> = Awaited<ReturnType<(typeof bankJobs)[J]>>;

/**
 * Runs a bank job in the worker, or on this thread where workers aren't available (or the
 * worker fails), so the bank still loads, just less smoothly.
 */
export async function runBankJob<J extends BankJob>(job: J, ...args: Parameters<(typeof bankJobs)[J]>): Promise<Result<J>> {
  const run = () => (bankJobs[job] as (...a: unknown[]) => Promise<unknown>)(...args) as Promise<Result<J>>;
  const w = getWorker();
  if (!w) return run();
  try {
    return await new Promise<Result<J>>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage({ id, job, args });
    });
  } catch {
    return run();
  }
}
