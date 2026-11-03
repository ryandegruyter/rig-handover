import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest, StatusCounts } from './types.js';

const STATUSES = new Set<DigestStatus>(['ok', 'retry', 'fail']);

type Event = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

function parseLine(line: string): Event | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.at !== 'string' || typeof rec.job !== 'string' || rec.job === '') return null;
  if (typeof rec.status !== 'string' || !STATUSES.has(rec.status as DigestStatus)) return null;
  if (rec.owner !== null && typeof rec.owner !== 'string') return null;
  if (rec.error !== undefined && typeof rec.error !== 'string') return null;
  return {
    at: rec.at,
    job: rec.job,
    status: rec.status as DigestStatus,
    owner: rec.owner,
    error: typeof rec.error === 'string' ? rec.error : null,
  };
}

function byTime(a: Event, b: Event): number {
  return Date.parse(a.at) - Date.parse(b.at);
}

export function readNight(runsDir: string, night: string): NightDigest {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  const byJob = new Map<string, Event[]>();

  for (const line of text.split('\n')) {
    if (line === '') continue;
    const event = parseLine(line);
    if (!event) {
      badLines += 1;
      continue;
    }
    counts[event.status] += 1;
    const list = byJob.get(event.job);
    if (list) list.push(event);
    else byJob.set(event.job, [event]);
  }

  const rows: DigestRow[] = [];
  for (const [job, events] of byJob) {
    const ordered = [...events].sort(byTime);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (!first || !last) continue;
    rows.push({
      job,
      owner: last.owner,
      runs: events.length,
      retries: events.filter((event) => event.status === 'retry').length,
      lastStatus: last.status,
      lastError: last.error,
      firstAt: first.at,
      lastAt: last.at,
    });
  }
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines, counts };
}
