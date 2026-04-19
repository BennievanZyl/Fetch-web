// ─────────────────────────────────────────────────────────────
// Fetch Admin — Shared Library
// Auto-refreshes JWT every 10 minutes so sessions never expire
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://errbnpeswpjmdsvehduz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycmJucGVzd3BqbWRzdmVoZHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDgzMDMsImV4cCI6MjA4NjgyNDMwM30.ZYeZUV6PFs_yATPMUisH9vzXwWaMpBUwEn6Dsy6F0z8';

// ── Token management ─────────────────────────────────────────
function getToken() {
  return localStorage.getItem('fetch_admin_token');
}
function getRefreshToken() {
  return localStorage.getItem('fetch_admin_refresh_token');
}
function setTokens(access, refresh) {
  if (access) localStorage.setItem('fetch_admin_token', access);
  if (refresh) localStorage.setItem('fetch_admin_refresh_token', refresh);
}

// ── Auto-refresh token every 10 minutes ──────────────────────
async function refreshAdminToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ refresh_token: refresh })
    });

    if (!res.ok) {
      console.warn('Token refresh failed:', res.status);
      return false;
    }

    const data = await res.json();
    if (data.access_token) {
      setTokens(data.access_token, data.refresh_token);
      console.log('Admin token refreshed ✓');
      return true;
    }
  } catch (e) {
    console.warn('Token refresh error:', e);
  }
  return false;
}

// Start auto-refresh on page load — every 10 minutes
function startTokenRefresh() {
  if (!getToken()) return;
  // Refresh immediately on load to ensure token is fresh
  refreshAdminToken();
  // Then every 10 minutes
  setInterval(refreshAdminToken, 10 * 60 * 1000);
}

// ── Auth headers ─────────────────────────────────────────────
function authHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${getToken() || SUPABASE_KEY}`,
    ...extra
  };
}

// ── Core fetch with auto-retry on 401 ───────────────────────
async function apiFetch(url, options = {}, retried = false) {
  const res = await fetch(url, options);

  // If 401 and not already retried — refresh token and retry once
  if (res.status === 401 && !retried) {
    console.warn('Got 401 — refreshing token and retrying...');
    const refreshed = await refreshAdminToken();
    if (refreshed) {
      // Rebuild headers with new token
      const newOptions = {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${getToken()}`,
        }
      };
      return apiFetch(url, newOptions, true);
    } else {
      // Refresh failed — redirect to login
      console.error('Token refresh failed — redirecting to login');
      showSessionExpiredBanner();
      return res;
    }
  }

  return res;
}

// ── Show banner instead of sudden redirect ───────────────────
function showSessionExpiredBanner() {
  // Don't show if already showing
  if (document.getElementById('session-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'session-banner';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #E74C3C; color: #fff; padding: 14px 24px;
    display: flex; align-items: center; justify-content: space-between;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
    box-shadow: 0 2px 12px rgba(0,0,0,0.2);
  `;
  banner.innerHTML = `
    <span>⚠️ Your session has expired. Please sign in again.</span>
    <button onclick="window.location.href='/admin'" style="
      background: #fff; color: #E74C3C; border: none; border-radius: 8px;
      padding: 8px 16px; font-weight: 700; cursor: pointer; font-size: 13px;
    ">Sign In Again</button>
  `;
  document.body.prepend(banner);
}

// ── Database helpers ─────────────────────────────────────────
async function sbGet(table, params = '') {
  const res = await apiFetch(
    `${SUPABASE_URL}/rest/v1/${table}${params}`,
    { headers: authHeaders() }
  );
  if (!res.ok && res.status !== 401) {
    console.error(`sbGet ${table} failed:`, res.status);
    return [];
  }
  return res.json();
}

async function sbPost(table, body) {
  const res = await apiFetch(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      method: 'POST',
      headers: authHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(body)
    }
  );
  return res.json();
}

async function sbPatch(table, id, body) {
  const res = await apiFetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: authHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(body)
    }
  );
  return res.json();
}

async function sbDelete(table, id) {
  await apiFetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`,
    { method: 'DELETE', headers: authHeaders() }
  );
}

// ── Connection health check ───────────────────────────────────
// Ping Supabase every 5 minutes to detect lost connection
async function checkConnection() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?limit=1`, {
      headers: authHeaders()
    });
    if (res.status === 401) {
      const refreshed = await refreshAdminToken();
      if (!refreshed) showSessionExpiredBanner();
    } else {
      // Connection OK — remove banner if it was showing
      const banner = document.getElementById('session-banner');
      if (banner) banner.remove();
    }
  } catch (e) {
    console.warn('Connection check failed:', e);
  }
}

// ── Admin auth ───────────────────────────────────────────────
function guardAdmin() {
  if (!getToken()) {
    window.location.href = '/admin';
    return false;
  }
  // Start auto-refresh when guard passes
  startTokenRefresh();
  // Check connection every 5 minutes
  setInterval(checkConnection, 5 * 60 * 1000);
  return true;
}

function signOut() {
  // Invalidate token server-side
  const token = getToken();
  if (token) {
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: authHeaders()
    }).catch(() => {});
  }
  localStorage.removeItem('fetch_admin_token');
  localStorage.removeItem('fetch_admin_refresh_token');
  localStorage.removeItem('fetch_admin_user');
  window.location.href = '/admin';
}

// ── Utilities ────────────────────────────────────────────────
function generateCode() {
  return 'FETCH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function formatZAR(amount) {
  return 'R' + parseFloat(amount || 0).toFixed(2);
}

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
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function statusPill(status) {
  const map = {
    pending:          ['#FFF8E6', '#9A6500'],
    confirmed:        ['#E6F0FB', '#1A5FA5'],
    preparing:        ['#FFF8E6', '#9A6500'],
    ready:            ['#F3E6FB', '#6B21A8'],
    picked_up:        ['#E6F9F0', '#0A7A45'],
    out_for_delivery: ['#E6F9F0', '#0A7A45'],
    delivered:        ['#E6F9F0', '#0A7A45'],
    cancelled:        ['#FDECEA', '#B91C1C'],
    active:           ['#E6F9F0', '#0A7A45'],
    onboarding:       ['#F7F7F7', '#8E8E8E'],
    paused:           ['#FFF8E6', '#9A6500'],
    suspended:        ['#FDECEA', '#B91C1C'],
    approved:         ['#E6F9F0', '#0A7A45'],
    rejected:         ['#FDECEA', '#B91C1C'],
    driver:           ['#E6F9F0', '#0A7A45'],
    suspended_driver: ['#FDECEA', '#B91C1C'],
  };
  const [bg, color] = map[status] || ['#F7F7F7', '#8E8E8E'];
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap">${label}</span>`;
}

function buildSidebar(activePage) {
  const pages = [
    { id:'dashboard', icon:'📊', label:'Dashboard',       href:'/admin/dashboard' },
    { id:'enquiries', icon:'📋', label:'Enquiries',       href:'/admin/enquiries' },
    { id:'stores',    icon:'🏪', label:'Stores',          href:'/admin/stores' },
    { id:'codes',     icon:'🎟️', label:'Invite Codes',    href:'/admin/codes' },
    { id:'orders',    icon:'🛒', label:'Orders',          href:'/admin/orders' },
    { id:'drivers',   icon:'🚗', label:'Drivers',         href:'/admin/drivers' },
    { id:'devices',   icon:'📱', label:'Linked Devices',  href:'/admin/devices' },
    { id:'menu',      icon:'🍽️', label:'Menu Builder',    href:'/admin/menu' },
  ];
  const items = pages.map(p =>
    `<a href="${p.href}" class="sidebar-item ${p.id===activePage?'active':''}">
      <span>${p.icon}</span><span>${p.label}</span>
    </a>`
  ).join('');
  return `
    <aside class="sidebar">
      <div class="sidebar-logo">FETCH<span>.</span></div>
      <div class="sidebar-badge">Admin</div>
      <nav class="sidebar-nav">${items}</nav>
      <button class="sidebar-signout" onclick="signOut()">Sign Out</button>
    </aside>`;
}

function showModal(html) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:40px;max-width:520px;width:100%;position:relative">
      ${html}
      <button onclick="closeModal()" style="position:absolute;top:16px;right:16px;background:#f7f7f7;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px">✕</button>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const o = btn.textContent;
    btn.textContent = 'Copied! ✓';
    btn.style.background = '#06C167';
    btn.style.color = '#fff';
    setTimeout(() => { btn.textContent = o; btn.style.background = ''; btn.style.color = ''; }, 2000);
  });
}

function whatsappLink(phone, code, ownerName, storeName) {
  const num = (phone || '').replace(/\D/g, '').replace(/^0/, '27');
  const msg = encodeURIComponent(
    `Hi ${ownerName}! 👋 Welcome to Fetch 🎉\n\nYour store *${storeName}* has been approved!\n\nDownload the Fetch app and enter your Partner Code:\n\n*${code}*\n\nYour code expires in 30 days. Reply if you need help!`
  );
  return `https://wa.me/${num}?text=${msg}`;
}
