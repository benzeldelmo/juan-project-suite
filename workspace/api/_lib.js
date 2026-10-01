import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server Supabase credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Public Supabase credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function bearer(req) {
  const value = req.headers.authorization || '';
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

export async function requireUser(req) {
  const token = bearer(req);
  if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const svc = serviceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error('Invalid or expired session.'), { status: 401 });
  return { user: data.user, svc, token };
}

export async function requireAdmin(req) {
  const ctx = await requireUser(req);
  const { data, error } = await ctx.svc.from('user_roles').select('role').eq('auth_user_id', ctx.user.id).maybeSingle();
  if (error || data?.role !== 'admin') throw Object.assign(new Error('Admin authorization required.'), { status: 403 });
  return ctx;
}

function makeLegacyClientId(userId) {
  return `client_${Date.now()}_${String(userId).replace(/-/g,'').slice(0,8)}`;
}

export async function ensurePortalAccount(user, svc) {
  let { data: account, error } = await svc.from('portal_accounts').select('*').eq('auth_user_id', user.id).maybeSingle();
  if (error) throw error;
  if (account) {
    if (account.portal_enabled === false) throw Object.assign(new Error('Your JUAN PROJECT Online access is currently disabled. Please contact JUAN PROJECT.'), { status: 403 });
    return account;
  }

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) throw Object.assign(new Error('Authenticated account has no email address.'), { status: 403 });

  const { data: role, error: roleError } = await svc.from('user_roles').select('role').eq('auth_user_id', user.id).maybeSingle();
  if (roleError) throw roleError;
  if (role?.role === 'admin') {
    throw Object.assign(new Error('The Workspace administrator account cannot be used as a client portal account.'), { status: 403 });
  }

  const clientResult = await svc
    .from('clients')
    .select('id,name,email,phone,address,client_code')
    .ilike('email', email)
    .order('client_code', { ascending: true })
    .limit(2);
  if (clientResult.error) throw clientResult.error;
  const matches = clientResult.data || [];
  if (!matches.length) throw Object.assign(new Error('No JUAN PROJECT client profile is linked to this account. Please contact JUAN PROJECT.'), { status: 403 });
  if (matches.length > 1) throw Object.assign(new Error('More than one client profile uses this email. Please contact JUAN PROJECT so the duplicate can be resolved.'), { status: 409 });
  const client = matches[0];

  const { data: clientAccount, error: clientAccountError } = await svc.from('portal_accounts').select('*').eq('client_id', client.id).maybeSingle();
  if (clientAccountError) throw clientAccountError;
  if (clientAccount && String(clientAccount.auth_user_id) !== String(user.id)) {
    throw Object.assign(new Error('This client profile is already linked to another login. Please contact JUAN PROJECT.'), { status: 409 });
  }
  if (clientAccount) return clientAccount;

  const insertedAccount = await svc.from('portal_accounts').insert({
    auth_user_id: user.id,
    client_id: client.id,
    password_set: false,
    portal_enabled: true
  }).select('*').single();

  if (insertedAccount.error) {
    if (insertedAccount.error.code === '23505') {
      const retry = await svc.from('portal_accounts').select('*').eq('auth_user_id', user.id).maybeSingle();
      if (!retry.error && retry.data) return retry.data;
    }
    throw insertedAccount.error;
  }

  if (!role) {
    const roleInsert = await svc.from('user_roles').insert({ auth_user_id: user.id, role: 'client' });
    if (roleInsert.error && roleInsert.error.code !== '23505') throw roleInsert.error;
  }
  return insertedAccount.data;
}

export async function enforceRateLimit(req, svc, scope, subject='', maxHits=6, windowSeconds=900){const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim(),ip=forwarded||String(req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown'),raw=`${scope}|${ip}|${String(subject||'').trim().toLowerCase()}`,key=`${scope}:${createHash('sha256').update(raw).digest('hex')}`;const {data,error}=await svc.rpc('consume_juan_rate_limit',{p_key:key,p_window_seconds:windowSeconds,p_max_hits:maxHits});if(error)throw Object.assign(new Error('Security rate-limit check is unavailable. Please try again.'),{status:503});if(data!==true)throw Object.assign(new Error('Too many attempts. Please wait before trying again.'),{status:429,retryAfter:windowSeconds});}

export function sendError(res, error) {
  console.error(error);
  const status=error?.status||500;
  if(status===429&&Number(error?.retryAfter)>0)res.setHeader('Retry-After',String(Math.ceil(Number(error.retryAfter))));
  const payload={error:error?.message||'Unexpected server error.'};
  if(status===429&&Number(error?.retryAfter)>0)payload.retry_after_seconds=Math.ceil(Number(error.retryAfter));
  return res.status(status).json(payload);
}


export function assertSafePost(req, maxBytes = 131072) {
  const length = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(length) && length > maxBytes) {
    throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  const type = String(req.headers['content-type'] || '').toLowerCase();
  if (req.method === 'POST' && !type.includes('application/json')) {
    throw Object.assign(new Error('Unsupported request format.'), { status: 415 });
  }
  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite && !['same-origin','same-site','none'].includes(fetchSite)) {
    throw Object.assign(new Error('Cross-site request blocked.'), { status: 403 });
  }
  const origin = String(req.headers.origin || '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (origin && host) {
    let originHost = '';
    try { originHost = new URL(origin).host; } catch {}
    if (originHost && originHost !== host) {
      throw Object.assign(new Error('Origin check failed.'), { status: 403 });
    }
  }
}
