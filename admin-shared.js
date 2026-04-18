const SUPABASE_URL = 'https://errbnpeswpjmdsvehduz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycmJucGVzd3BqbWRzdmVoZHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDgzMDMsImV4cCI6MjA4NjgyNDMwM30.ZYeZUV6PFs_yATPMUisH9vzXwWaMpBUwEn6Dsy6F0z8';

function getToken() { return localStorage.getItem('fetch_admin_token'); }
function authHeaders() {
  return { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${getToken() || SUPABASE_KEY}` };
}
function guardAdmin() { if (!getToken()) { window.location.href = 'admin-login.html'; return false; } return true; }
function signOut() { localStorage.removeItem('fetch_admin_token'); localStorage.removeItem('fetch_admin_user'); window.location.href = 'admin-login.html'; }

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

function generateCode() { return 'FETCH-' + Math.random().toString(36).substring(2, 8).toUpperCase(); }
function formatZAR(amount) { return 'R' + parseFloat(amount || 0).toFixed(2); }
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
function statusPill(status) {
  const map = { pending:['#FFF8E6','#9A6500'], confirmed:['#E6F0FB','#1A5FA5'], preparing:['#FFF8E6','#9A6500'], ready:['#F3E6FB','#6B21A8'], picked_up:['#E6F9F0','#0A7A45'], delivered:['#E6F9F0','#0A7A45'], cancelled:['#FDECEA','#B91C1C'], active:['#E6F9F0','#0A7A45'], onboarding:['#F7F7F7','#8E8E8E'], paused:['#FFF8E6','#9A6500'], suspended:['#FDECEA','#B91C1C'], approved:['#E6F9F0','#0A7A45'], rejected:['#FDECEA','#B91C1C'], driver:['#E6F9F0','#0A7A45'], suspended_driver:['#FDECEA','#B91C1C'] };
  const [bg, color] = map[status] || ['#F7F7F7','#8E8E8E'];
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap">${label}</span>`;
}
function buildSidebar(activePage) {
  const pages = [
    { id:'dashboard', icon:'📊', label:'Dashboard',    href:'admin-dashboard.html' },
    { id:'enquiries', icon:'📋', label:'Enquiries',    href:'admin-enquiries.html' },
    { id:'stores',    icon:'🏪', label:'Stores',       href:'admin-stores.html' },
    { id:'codes',     icon:'🎟️', label:'Invite Codes', href:'admin-codes.html' },
    { id:'orders',    icon:'🛒', label:'Orders',       href:'admin-orders.html' },
    { id:'drivers',   icon:'🚗', label:'Drivers',      href:'admin-drivers.html' },
  ];
  const items = pages.map(p => `<a href="${p.href}" class="sidebar-item ${p.id===activePage?'active':''}""><span>${p.icon}</span><span>${p.label}</span></a>`).join('');
  return `<aside class="sidebar"><div class="sidebar-logo">FETCH<span>.</span></div><div class="sidebar-badge">Admin</div><nav class="sidebar-nav">${items}</nav><button class="sidebar-signout" onclick="signOut()">Sign Out</button></aside>`;
}
function showModal(html) {
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto';
  overlay.innerHTML = `<div style="background:#fff;border-radius:20px;padding:40px;max-width:520px;width:100%;position:relative">${html}<button onclick="closeModal()" style="position:absolute;top:16px;right:16px;background:#f7f7f7;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px">✕</button></div>`;
  overlay.addEventListener('click', e => { if(e.target===overlay) closeModal(); });
  document.body.appendChild(overlay);
}
function closeModal() { const el = document.getElementById('modal-overlay'); if(el) el.remove(); }
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => { const o=btn.textContent; btn.textContent='Copied! ✓'; btn.style.background='#06C167'; btn.style.color='#fff'; setTimeout(()=>{btn.textContent=o;btn.style.background='';btn.style.color='';},2000); });
}
function whatsappLink(phone, code, ownerName, storeName) {
  const num = (phone||'').replace(/\D/g,'').replace(/^0/,'27');
  const msg = encodeURIComponent(`Hi ${ownerName}! 👋 Welcome to Fetch 🎉\n\nYour store *${storeName}* has been approved!\n\nDownload the Fetch app and enter your Partner Code:\n\n*${code}*\n\nYour code expires in 30 days. Reply if you need help!`);
  return `https://wa.me/${num}?text=${msg}`;
}
