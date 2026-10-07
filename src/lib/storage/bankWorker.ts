/// <reference lib="webworker" />
/**
 * Runs the bank jobs off the page's main thread. Each message names a job and its arguments;
 * the reply carries the same id with the result or the error.
 */
import { readAllMeta, syncShippedBank } from './bankJobs';

const jobs = { syncShippedBank, readAllMeta } as const;
export type BankJob = keyof typeof jobs;

self.onmessage = async (e: MessageEvent<{ id: number; job: BankJob; args: unknown[] }>) => {
  const { id, job, args } = e.data;
  try {
    const value = await (jobs[job] as (...a: unknown[]) => Promise<unknown>)(...args);
    self.postMessage({ id, ok: true, value });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
