const encoder = new TextEncoder();
const sessionCookie = '__Host-ashiu_session';
const lifetime = 8 * 60 * 60;
const hex = bytes => Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
async function equal(a, b) {
  const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  const l = new Uint8Array(left), r = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < l.length; i++) difference |= l[i] ^ r[i];
  return difference === 0;
}
async function sign(value, password) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function loginPage(headers, failed = false) {
  return new Response(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>阿修型態研選｜登入</title><style>body{margin:0;background:#10151d;color:#ffe3a0;font-family:system-ui,"Microsoft JhengHei",sans-serif;display:grid;place-items:center;min-height:100vh}main{width:min(360px,80vw);padding:32px;border:1px solid #876a3e;border-radius:24px;background:#202120}h1{font-size:26px}p{color:#b9c5c0;line-height:1.7}label{display:block;margin:24px 0 8px}input,button{box-sizing:border-box;width:100%;font-size:18px;padding:12px;border-radius:10px}input{background:#13241f;color:white;border:1px solid #527268}button{margin-top:20px;background:#50d3bd;border:0;color:#112b25;cursor:pointer}.error{color:#ffb276}</style><main><h1>阿修型態研選</h1><p>請輸入共用密碼以查看選股資訊。</p>${failed?'<p class="error" role="alert">密碼不正確，請再試一次。</p>':''}<form method="post" action="/__login"><label for="password">共用密碼</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">登入</button></form></main></html>`, { status: failed ? 401 : 200, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } });
}
// Authentication precedes every asset request; no public origin proxy is used.
export default {
  async fetch(request, env) {
    const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
    if (!env.SHARED_PASSWORD) return new Response('Password protection is not configured.', { status: 503, headers });
    const url = new URL(request.url);
    if (url.protocol !== 'https:') return new Response('HTTPS required.', { status: 400, headers });
    const now = Math.floor(Date.now() / 1000);
    if (url.pathname === '/__login' && request.method === 'POST') {
      if (request.headers.get('Origin') !== url.origin) return new Response('Invalid origin.', { status: 403, headers });
      const body = await request.text();
      if (body.length > 4096) return new Response('Request too large.', { status: 413, headers });
      const supplied = new URLSearchParams(body).get('password') || '';
      if (!await equal(supplied, env.SHARED_PASSWORD)) return loginPage(headers, true);
      const payload = (now + lifetime) + '.' + hex(crypto.getRandomValues(new Uint8Array(16)));
      const token = payload + '.' + await sign(payload, env.SHARED_PASSWORD);
      return new Response(null, { status: 303, headers: { ...headers, Location: '/', 'Set-Cookie': `${sessionCookie}=${token}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${lifetime}` } });
    }
    const token = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1) || '';
    const parts = token.split('.');
    const expiry = Number(parts[0]);
    const valid = parts.length === 3 && /^\d+$/.test(parts[0]) && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{64}$/.test(parts[2]) && expiry > now && expiry <= now + lifetime && await equal(parts[2], await sign(parts[0] + '.' + parts[1], env.SHARED_PASSWORD));
    if (!valid) return url.pathname === '/' && ['GET', 'HEAD'].includes(request.method) ? loginPage(headers) : new Response('Sign in required.', { status: 401, headers });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed.', { status: 405, headers });
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }
};
