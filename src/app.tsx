import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function nightOnDisk(runsDir: string, night: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(night) && existsSync(join(runsDir, `${night}.jsonl`));
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!nightOnDisk(config.runsDir, night)) return c.notFound();
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} digest={readNight(config.runsDir, night)} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!nightOnDisk(config.runsDir, night)) return c.notFound();
    return c.json(readNight(config.runsDir, night));
  });

  return app;
}
