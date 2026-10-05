// All asset requests must pass authentication. No public origin proxy is used.
export default {
  async fetch(request, env) {
    const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
    if (!env.SHARED_PASSWORD) return new Response('Password protection is not configured.', { status: 503, headers });
    if (new URL(request.url).protocol !== 'https:') return new Response('HTTPS required.', { status: 400, headers });
    let supplied = '';
    const authorization = request.headers.get('Authorization') || '';
    if (authorization.startsWith('Basic ')) {
      try { supplied = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(authorization.slice(6)), c => c.charCodeAt(0))); } catch { /* invalid credential */ }
    }
    const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [actual, expected] = await Promise.all([digest(supplied), digest('ashiu:' + env.SHARED_PASSWORD)]);
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
    if (difference) return new Response('Please sign in to view Ashiu Stock.', {
      status: 401, headers: { ...headers, 'WWW-Authenticate': 'Basic realm="Ashiu Stock", charset="UTF-8"' }
    });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed.', { status: 405, headers });
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }
};
