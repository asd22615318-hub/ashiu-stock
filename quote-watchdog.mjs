const workflow = 'quotes-fast.yml';
const repository = 'asd22615318-hub/ashiu-stock';
const api = 'https://api.github.com/repos/' + repository + '/actions';

export async function checkClosingQuotes(scheduledTime, env, request = fetch) {
  if (!env.QUOTE_WATCHDOG_GITHUB_TOKEN) return 'awaiting-token';

  const taipei = new Date(scheduledTime + 8 * 60 * 60 * 1000);
  const day = taipei.toISOString().slice(0, 10);
  if ([0, 6].includes(taipei.getUTCDay())) return 'non-trading-day';

  const response = await env.ASSETS.fetch(new Request('https://assets.internal/quote-update-status.json'));
  if (!response.ok) throw new Error('Quote update status asset unavailable: ' + response.status);
  const status = await response.json();
  if (status.calendar_year !== taipei.getUTCFullYear() || !Array.isArray(status.closed_dates)) {
    return 'awaiting-trading-calendar';
  }
  if (status.closed_dates.includes(day)) return 'non-trading-day';
  if (status.listed >= day && status.otc >= day) return 'already-current';

  const headers = {
    Authorization: 'Bearer ' + env.QUOTE_WATCHDOG_GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'ashiu-stock-quote-watchdog'
  };
  // The lightweight refresh and the full market update can both publish quotes.
  for (const file of [workflow, 'pages.yml']) {
    const runs = await request(api + '/workflows/' + file + '/runs?branch=main&per_page=15', {
      headers, signal: AbortSignal.timeout(12000)
    });
    if (!runs.ok) throw new Error('Unable to check GitHub workflow status: ' + runs.status);
    const { workflow_runs: jobs } = await runs.json();
    if (!Array.isArray(jobs)) throw new Error('Unexpected GitHub workflow response.');
    if (jobs.some(job => job.status !== 'completed')) return 'update-in-progress';
  }

  const dispatch = await request(api + '/workflows/' + workflow + '/dispatches', {
    method: 'POST', headers, body: JSON.stringify({ ref: 'main' }),
    signal: AbortSignal.timeout(12000)
  });
  if (!dispatch.ok) throw new Error('GitHub rejected quote workflow dispatch: ' + dispatch.status);
  return 'update-dispatched';
}
