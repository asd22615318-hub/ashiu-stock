const quoteWorkflow = 'quotes-fast.yml';
const api = 'https://api.github.com/repos/asd22615318-hub/ashiu-stock/actions';

async function readSnapshot(env, path) {
  const response = await env.ASSETS.fetch(new Request('https://assets.internal/' + path));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(path + ' unavailable: ' + response.status);
  return response.json();
}

async function dispatchIfIdle(workflow, related, headers, request) {
  for (const file of [workflow, ...related]) {
    const runs = await request(api + '/workflows/' + file + '/runs?branch=main&per_page=15', {
      headers, signal: AbortSignal.timeout(12000)
    });
    if (!runs.ok) throw new Error(file + ' status check failed: ' + runs.status);
    const { workflow_runs: jobs } = await runs.json();
    if (!Array.isArray(jobs)) throw new Error('Unexpected GitHub workflow response.');
    if (jobs.some(job => job.status !== 'completed')) return 'update-in-progress';
    // A just-published snapshot may still be waiting for the Cloudflare build.
    if (jobs.some(job => job.conclusion === 'success' &&
      Date.now() - Date.parse(job.updated_at) < 5 * 60 * 1000)) return 'awaiting-deployment';
  }

  const dispatch = await request(api + '/workflows/' + workflow + '/dispatches', {
    method: 'POST', headers, body: JSON.stringify({ ref: 'main' }),
    signal: AbortSignal.timeout(12000)
  });
  if (!dispatch.ok) throw new Error(workflow + ' dispatch rejected: ' + dispatch.status);
  return 'update-dispatched';
}

export async function checkClosingQuotes(scheduledTime, env, request = fetch) {
  if (!env.QUOTE_WATCHDOG_GITHUB_TOKEN) return 'awaiting-token';

  const taipei = new Date(scheduledTime + 8 * 60 * 60 * 1000);
  const day = taipei.toISOString().slice(0, 10);
  if ([0, 6].includes(taipei.getUTCDay())) return 'non-trading-day';

  const status = await readSnapshot(env, 'quote-update-status.json');
  if (!status) throw new Error('Quote update status asset unavailable');
  if (status.calendar_year !== taipei.getUTCFullYear() || !Array.isArray(status.closed_dates)) {
    return 'awaiting-trading-calendar';
  }
  if (status.closed_dates.includes(day)) return 'non-trading-day';

  const headers = {
    Authorization: 'Bearer ' + env.QUOTE_WATCHDOG_GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'ashiu-stock-quote-watchdog'
  };
  const quotesCurrent = status.listed >= day && status.otc >= day;
  const checks = {
    quotes: async () => quotesCurrent ? 'already-current' :
      dispatchIfIdle(quoteWorkflow, ['pages.yml'], headers, request)
  };
  // Give both primary evening schedules time to fetch and publish before retrying.
  const minute = taipei.getUTCHours() * 60 + taipei.getUTCMinutes();
  if (minute >= 18 * 60 + 55) {
    checks.overnight = async () => {
      if (!quotesCurrent) return 'awaiting-quotes';
      const snapshot = await readSnapshot(env, 'overnight-data.json');
      return snapshot?.date >= day ? 'already-current' :
        dispatchIfIdle('overnight.yml', [], headers, request);
    };
    checks.warrants = async () => {
      const snapshot = await readSnapshot(env, 'warrant-data.json');
      return snapshot?.date >= day ? 'already-current' :
        dispatchIfIdle('warrants.yml', [], headers, request);
    };
  }
  const results = await Promise.allSettled(Object.values(checks).map(check => check()));
  const outcomes = Object.fromEntries(Object.keys(checks).map((name, i) => [
    name, results[i].status === 'fulfilled' ? results[i].value : 'failed'
  ]));
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) {
    console.error('Daily update backup results:', outcomes);
    throw new AggregateError(failures.map(result => result.reason),
      failures.map(result => result.reason.message).join('; '));
  }
  return outcomes;
}
