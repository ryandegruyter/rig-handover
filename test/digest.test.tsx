import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

let runsDir: string;

function app() {
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
  return createApp(config);
}

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function jobsIn(html: string): string[] {
  return [...html.matchAll(/<td>([^<]+)<\/td>/g)].map((match) => match[1] ?? '').filter((cell) => cell.includes('/'));
}

describe('digest page', () => {
  it('renders a night with a bad line', async () => {
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
        '{"at":"2026-10-28T23:10:00+01:00","job":"notes/backup","status":"fail","owner":null,"error":"quota exceeded"}',
        '{"job":"lane/sy',
      ].join('\n'),
    );
    const res = await app().request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('notes/backup')).toBeLessThan(html.indexOf('rig/rotate-logs'));
    expect(html).toContain('—');
    expect(html).toContain('1 unreadable line');
    expect(html).toContain('quota exceeded');
  });

  it('returns 404 when the night has no file', async () => {
    const res = await app().request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('renders nothing ran for an empty file', async () => {
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const res = await app().request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
});

describe('digest JSON', () => {
  it('matches the page for the 2026-10-28 fixture', async () => {
    const real = createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir: 'runs',
    });
    const page = await real.request('/digest/2026-10-28');
    const json = await real.request('/api/digest/2026-10-28');
    const body = await json.json();
    expect(body.rows.map((row: { job: string }) => row.job)).toEqual(jobsIn(await page.text()));
    expect(body.rows).toHaveLength(5);
  });

  it('returns the same jobs in the same order as the page', async () => {
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
        '{"at":"2026-10-28T23:10:00+01:00","job":"notes/backup","status":"fail","owner":null,"error":"quota exceeded"}',
        '{"job":"lane/sy',
      ].join('\n'),
    );
    const page = await app().request('/digest/2026-10-28');
    const json = await app().request('/api/digest/2026-10-28');
    const body = await json.json();
    expect(json.status).toBe(200);
    expect(body.rows.map((row: { job: string }) => row.job)).toEqual(jobsIn(await page.text()));
    expect(body.badLines).toBe(1);
  });

  it('returns 404 when the night has no file', async () => {
    expect((await app().request('/api/digest/2026-01-01')).status).toBe(404);
  });

  it('returns no rows for an empty file', async () => {
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const body = await (await app().request('/api/digest/2026-10-28')).json();
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });
});
