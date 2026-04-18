const SUPABASE_URL = 'https://errbnpeswpjmdsvehduz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycmJucGVzd3BqbWRzdmVoZHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDgzMDMsImV4cCI6MjA4NjgyNDMwM30.ZYeZUV6PFs_yATPMUisH9vzXwWaMpBUwEn6Dsy6F0z8';

function getToken() { return localStorage.getItem('fetch_admin_token'); }
function authHeaders() {
  return { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${getToken() || SUPABASE_KEY}` };
}
function guardAdmin() { if (!getToken()) { window.location.href = '/admin'; return false; } return true; }
function signOut() { localStorage.removeItem('fetch_admin_token'); localStorage.removeItem('fetch_admin_user'); window.location.href = '/admin'; }

async function sbGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers: authHeaders() });
  return res.json();
}
async function sbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: { ...authHeaders(), 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
  return res.json();
}
async function sbPatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'PATCH', headers: { ...authHeaders(), 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
  return res.json();
}
async function sbDelete(table, id) { await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: authHeaders() }); }

function
