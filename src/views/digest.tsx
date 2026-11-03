import type { DigestRow, NightDigest } from '../digest/types.js';

function marked(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function shown(value: string | null): string {
  return value ?? '—';
}

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  if (digest.rows.length === 0 && digest.badLines === 0) {
    return <p>nothing ran</p>;
  }
  return (
    <>
      <h1>digest {night}</h1>
      <table>
        <thead>
          <tr>
            <th>job</th>
            <th>owner</th>
            <th>runs</th>
            <th>retries</th>
            <th>last status</th>
            <th>last error</th>
            <th>first</th>
            <th>last</th>
          </tr>
        </thead>
        <tbody>
          {digest.rows.map((row) => (
            <tr class={marked(row) ? 'warn' : undefined}>
              <td>{row.job}</td>
              <td>{shown(row.owner)}</td>
              <td>{row.runs}</td>
              <td>{row.retries}</td>
              <td>{row.lastStatus}</td>
              <td>{shown(row.lastError)}</td>
              <td>{row.firstAt}</td>
              <td>{row.lastAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {digest.badLines > 0 ? (
        <p class="mute">
          {digest.badLines} unreadable {digest.badLines === 1 ? 'line' : 'lines'}
        </p>
      ) : null}
    </>
  );
}
