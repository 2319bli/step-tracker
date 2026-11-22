const siteOrigin = 'https://2319bli.github.io';
const hexKey = /^[a-f0-9]{64}$/;
const validSteps = n => n === null || (Number.isSafeInteger(n) && n >= 0 && n <= 2147483647);

async function deviceId(request) {
  const token = (request.headers.get('Authorization') || '').match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function response(value, status = 200) {
  return new Response(value === null ? null : JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': siteOrigin, 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'X-Content-Type-Options': 'nosniff'
  }});
}

async function saveDay(db, body) {
  const { date, previous, steps } = body;
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today ||
      !validSteps(previous) || !validSteps(steps)) return response({error:'Invalid date or step count.'},400);
  const day = new Date(date+'T00:00:00Z');
  if (!Number.isFinite(+day) || day.toISOString().slice(0,10) !== date) return response({error:'Invalid calendar date.'},400);
  let mutation;
  if (steps === null) mutation=db.prepare('DELETE FROM step_days WHERE day=? AND steps IS ?').bind(date,previous);
  else if (previous === null) mutation=db.prepare('INSERT INTO step_days(day,steps) VALUES(?,?) ON CONFLICT(day) DO NOTHING').bind(date,steps);
  else mutation=db.prepare('UPDATE step_days SET steps=? WHERE day=? AND steps=?').bind(steps,date,previous);
  const result=await mutation.run();
  if (!result.meta.changes) {
    const current=await db.prepare('SELECT steps FROM step_days WHERE day=?').bind(date).first();
    if ((current?.steps ?? null) !== steps) return response({error:'This date changed on another device. Reopen the entry to use its latest count.'},409);
  }
  return response({date,steps});
}

export default {
  async fetch(request, env) {
    const path=new URL(request.url).pathname, method=request.method;
    if (request.headers.has('Origin') && request.headers.get('Origin')!==siteOrigin) return response({error:'Origin unavailable.'},403);
    if (method==='OPTIONS') return response(null,204);
    if (!['/steps','/device','/devices'].includes(path)) return response({error:'Unknown route.'},404);
    try {
      if (path==='/steps' && method==='GET') {
        const {results}=await env.DB.prepare('SELECT day,steps FROM step_days ORDER BY day').all();
        return response(Object.fromEntries(results.map(row=>[row.day,row.steps])));
      }
      const id=await deviceId(request);
      const paired=!!(id && await env.DB.prepare('SELECT 1 FROM step_devices WHERE id=?').bind(id).first());
      if (path==='/device' && method==='GET') return response({paired});
      if (!paired) return response({error:'Connect this browser to save to Cloudflare.'},401);
      if (!(path==='/steps' && method==='PUT' || path==='/devices' && method==='POST')) return response({error:'Unsupported method.'},405);
      let body;
      try { body=await request.json(); } catch { return response({error:'Invalid JSON.'},400); }
      if (!body || typeof body!=='object' || Array.isArray(body)) return response({error:'Invalid request.'},400);
      if (path==='/steps') return await saveDay(env.DB,body);
      if (typeof body.id!=='string' || !hexKey.test(body.id)) return response({error:'Invalid device ID.'},400);
      await env.DB.prepare('INSERT INTO step_devices(id) VALUES(?) ON CONFLICT(id) DO NOTHING').bind(body.id).run();
      return response({paired:true});
    } catch { return response({error:'Cloudflare storage is unavailable. Please try again.'},503); }
  }
};
