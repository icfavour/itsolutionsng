/** Shared UI components & helpers. */
import { auth, logout, fileUrl } from './api.js';
import { SITE } from './data.js';

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- dates & numbers ----------

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function fmtBytes(n) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export const pct = (score, max) => (max > 0 ? Math.round((score / max) * 100) : 0);

/** Nigerian grading scale. */
export function gradeOf(p) {
  if (p >= 70) return ['A', 'Excellent'];
  if (p >= 60) return ['B', 'Very Good'];
  if (p >= 50) return ['C', 'Good'];
  if (p >= 45) return ['D', 'Pass'];
  if (p >= 40) return ['E', 'Weak Pass'];
  return ['F', 'Fail'];
}

export function gradeBadge(p, withPct = true) {
  const [g, label] = gradeOf(p);
  const cls = p >= 50 ? 'ok' : p >= 40 ? 'warn' : 'bad';
  return `<span class="badge badge-grade-${cls}" title="${label}">${g}${withPct ? ' · ' + p + '%' : ''}</span>`;
}

// ---------- toast ----------

export function toast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : type === 'info' ? 'info' : ''}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3400);
  setTimeout(() => el.remove(), 3800);
}

// ---------- modal ----------

export function openModal({ title, body, footer = '', wide = false }) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${title}</h3><button class="modal-x" data-close aria-label="Close">✕</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('[data-close]').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  return { el: overlay, close };
}

export function confirmAction(message, { title = 'Please confirm', okLabel = 'Yes, continue', danger = true } = {}) {
  return new Promise((resolve) => {
    const m = openModal({
      title,
      body: `<p style="font-size:.95rem">${message}</p>`,
      footer: `<button class="btn btn-ghost" data-close>Cancel</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${esc(okLabel)}</button>`,
    });
    m.el.querySelector('#confirm-ok').addEventListener('click', () => { m.close(); resolve(true); });
    m.el.querySelector('[data-close]').addEventListener('click', () => resolve(false), { once: true });
    m.el.addEventListener('mousedown', (e) => { if (e.target === m.el) resolve(false); });
  });
}

// ---------- avatars & files ----------

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export function avatar(user, size = 40) {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`;
  const photo = user?.photoKey ? ` data-file="${esc(user.photoKey)}"` : '';
  return `<span class="avatar" style="${style}"${photo}>${initials(user?.name)}</span>`;
}

/** Replace [data-file] elements with authenticated blob images. */
export async function hydrateFiles(root = document) {
  const nodes = qsa('[data-file]', root);
  await Promise.all(nodes.map(async (node) => {
    try {
      const url = await fileUrl(node.getAttribute('data-file'));
      if (!url) return;
      if (node.tagName === 'IMG') node.src = url;
      else { node.style.backgroundImage = `url("${url}")`; node.classList.add('has-photo'); }
    } catch { /* leave initials */ }
  }));
}

/** Read a file input into {name, contentType, dataBase64}. Max 4MB. */
export function readFileInfo(input) {
  return new Promise((resolve, reject) => {
    const file = input.files && input.files[0];
    if (!file) return resolve(null);
    if (file.size > 4 * 1024 * 1024) return reject(new Error('File is too large — maximum size is 4 MB.'));
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      contentType: file.type || 'application/octet-stream',
      dataBase64: String(reader.result).split(',')[1] || '',
    });
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

export function fileExt(name) {
  const m = String(name || '').split('.').pop();
  return (m || 'file').slice(0, 4);
}

// ---------- form helpers ----------

export function field(label, inputHtml, hint = '') {
  return `<div class="field"><label>${label}</label>${inputHtml}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
}

export function input(id, { type = 'text', value = '', placeholder = '', required = false, attrs = '' } = {}) {
  return `<input class="input" id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${attrs}>`;
}

export function select(id, options, value, { required = false, placeholder = '' } = {}) {
  const opts = (placeholder ? [`<option value="">${esc(placeholder)}</option>`] : [])
    .concat(options.map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
    }));
  return `<select class="input" id="${id}" ${required ? 'required' : ''}>${opts.join('')}</select>`;
}

export function textarea(id, value = '', rows = 4) {
  return `<textarea class="input" id="${id}" rows="${rows}">${esc(value)}</textarea>`;
}

export const val = (id, root = document) => (qs(`#${id}`, root)?.value || '').trim();

// ---------- landing chrome ----------

const NAV = [
  ['', 'Home'], ['courses', 'Courses'], ['about', 'About Us'], ['contact', 'Contact'],
];

export function landingNav(active = '') {
  const { user } = auth();
  const portalLink = user
    ? `<a class="btn btn-dark btn-sm" href="#/portal/${user.role}">Go to ${roleLabel(user.role)} Portal</a>`
    : `<div class="dropdown" id="portal-dropdown">
         <button class="btn btn-outline btn-sm" id="portal-dd-btn">Portal Login ▾</button>
         <div class="dropdown-menu">
           <a href="#/login/student">Student Portal</a>
           <a href="#/signup">Create Student Account</a>
           <div class="sep"></div>
           <a href="#/login/facilitator">Facilitator Portal</a>
           <a href="#/login/admin">Admin Login</a>
         </div>
       </div>`;
  const signupBtn = user ? '' : '<a class="btn btn-dark btn-sm" href="#/signup">Sign Up</a>';
  return `
  <header class="site-header">
    <div class="container nav-wrap">
      <a class="brand" href="#/">
        <img src="assets/logo.jpeg" alt="TechSkill Academy logo">
        <span class="brand-text">TechSkill <b>Academy</b></span>
      </a>
      <nav class="nav-links" id="nav-links">
        ${NAV.map(([path, label]) => `<a href="#/${path}" class="${active === path ? 'active' : ''}">${label}</a>`).join('')}
      </nav>
      <div class="nav-actions">
        ${portalLink}
        ${signupBtn}
        <a class="btn btn-primary btn-sm btn-enroll" href="#/contact">Enroll Now</a>
        <button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>
      </div>
    </div>
  </header>`;
}

export function footer() {
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand">
            <img src="assets/logo.jpeg" alt="TechSkill Academy logo">
            <span>TechSkill Academy</span>
          </div>
          <p style="font-size:.9rem">Practical, hands-on ICT and technology training at all levels — CCTV, computer hardware, programming, data analysis, networking &amp; security, and general ICT knowledge.</p>
        </div>
        <div>
          <h4>Quick Links</h4>
          <a href="#/">Home</a>
          <a href="#/courses">Courses</a>
          <a href="#/about">About Us</a>
          <a href="#/contact">Contact &amp; Enrollment</a>
        </div>
        <div>
          <h4>Portals</h4>
          <a href="#/login/student">Student Portal</a>
          <a href="#/login/facilitator">Facilitator Portal</a>
          <a href="#/login/admin">Admin Login</a>
        </div>
        <div>
          <h4>Contact Us</h4>
          <ul class="footer-contact">
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg><span>${esc(SITE.address)}</span></li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="tel:${SITE.phoneIntl}">${SITE.phone}</a></li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg><a href="mailto:${SITE.email}">${SITE.email}</a></li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span>${SITE.hours}</span></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} TechSkill Academy. All rights reserved.</span>
        <span>Millennium Housing Estate, Ginti, Ikorodu, Lagos</span>
      </div>
    </div>
  </footer>
  <a class="wa-float" href="${SITE.whatsapp}" target="_blank" rel="noopener" title="Chat with us on WhatsApp" aria-label="Chat on WhatsApp">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.57-.35Zm-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.88-9.9 9.88Zm8.42-18.3A11.82 11.82 0 0 0 12.04 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.94L.06 24l6.31-1.65a11.88 11.88 0 0 0 5.67 1.44h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41Z"/></svg>
  </a>`;
}

export function bindLandingNav() {
  const toggle = qs('#nav-toggle');
  const links = qs('#nav-links');
  if (toggle && links) toggle.addEventListener('click', () => links.classList.toggle('open'));
  const ddBtn = qs('#portal-dd-btn');
  const dd = qs('#portal-dropdown');
  if (ddBtn && dd) {
    ddBtn.addEventListener('click', (e) => { e.stopPropagation(); dd.classList.toggle('open'); });
    document.addEventListener('click', () => dd.classList.remove('open'));
  }
}

// ---------- portal chrome ----------

export function roleLabel(role) {
  return { student: 'Student', facilitator: 'Facilitator', admin: 'Admin' }[role] || 'User';
}

const ICONS = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  explore: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/></svg>',
  classes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  assessments: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3V1M16 3V1M9 12l2 2 4-4"/></svg>',
  profile: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M5.5 16.5c.8-1.3 2-2 3.5-2s2.7.7 3.5 2M15 9h4M15 13h4"/></svg>',
  materials: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  grading: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  students: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  overview: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15v-4M12 15V7M17 15v-6"/></svg>',
  messages: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
  logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
};

const PORTAL_TABS = {
  student: [
    ['dashboard', 'Dashboard', ICONS.dashboard],
    ['explore', 'Enroll in Classes', ICONS.explore],
    ['classes', 'My Classes', ICONS.classes],
    ['assessments', 'Assessments & Grades', ICONS.assessments],
    ['profile', 'My Profile', ICONS.profile],
  ],
  facilitator: [
    ['dashboard', 'Dashboard', ICONS.dashboard],
    ['classes', 'My Classes', ICONS.classes],
    ['materials', 'Course Materials', ICONS.materials],
    ['assessments', 'Assessments', ICONS.assessments],
    ['grading', 'Grading', ICONS.grading],
    ['students', 'My Students', ICONS.students],
    ['profile', 'My Profile', ICONS.profile],
  ],
  admin: [
    ['overview', 'Overview', ICONS.overview],
    ['students', 'Students', ICONS.students],
    ['facilitators', 'Facilitators', ICONS.students],
    ['classes', 'Classes', ICONS.classes],
    ['messages', 'Messages', ICONS.messages],
    ['profile', 'My Profile', ICONS.profile],
  ],
};

export function portalShell({ role, active, title, subtitle, user, content }) {
  const tabs = PORTAL_TABS[role] || [];
  return `
  <div class="portal">
    <aside class="sidebar" id="sidebar">
      <a class="side-brand" href="#/">
        <img src="assets/logo.jpeg" alt="TechSkill Academy">
        <span>TechSkill<b>Academy</b></span>
      </a>
      <div class="side-user">
        ${avatar(user, 44)}
        <div><strong>${esc(user.name)}</strong><span>${roleLabel(role)} · ${esc(role === 'student' ? user.matricNo : user.email)}</span></div>
      </div>
      <nav class="side-nav">
        ${tabs.map(([id, label, icon]) =>
          `<a class="side-link ${id === active ? 'active' : ''}" href="#/portal/${role}/${id}">${icon}${label}</a>`
        ).join('')}
        <a class="side-link side-logout" href="#" id="side-logout">${ICONS.logout}Sign out</a>
      </nav>
    </aside>
    <main class="portal-main">
      <header class="topbar">
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu">☰</button>
        <div><h1>${title}</h1><div class="muted small">${subtitle}</div></div>
        <div class="topbar-user">${avatar(user, 40)}<span>${esc((user.name || '').split(' ')[0])}</span></div>
      </header>
      <section class="portal-content">${content}</section>
    </main>
  </div>`;
}

export function bindPortal() {
  const menu = qs('#menu-toggle');
  const sidebar = qs('#sidebar');
  if (menu && sidebar) {
    menu.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menu) {
        sidebar.classList.remove('open');
      }
    });
  }
  const logoutBtn = qs('#side-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
      window.location.hash = '#/';
      toast('You have been signed out.', 'info');
    });
  }
}

// ---------- misc ----------

export function emptyState(title, text, actionHtml = '') {
  return `<div class="empty">
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <div class="t">${esc(title)}</div>
    <div>${esc(text)}</div>
    ${actionHtml ? `<div class="mt-2">${actionHtml}</div>` : ''}
  </div>`;
}

export function errorPage(message) {
  return `<div class="error-page">
    <h1>Oops!</h1>
    <p class="muted">${esc(message)}</p>
    <a class="btn btn-primary" href="#/">Back to Home</a>
  </div>`;
}

export function statusBadgeFor(assessment) {
  const sub = assessment.mySubmission;
  if (!sub) {
    const overdue = assessment.dueDate && Date.now() > new Date(assessment.dueDate + 'T23:59:59').getTime();
    return overdue ? '<span class="badge badge-red">Overdue</span>' : '<span class="badge badge-gray">Not submitted</span>';
  }
  if (sub.score != null) return gradeBadge(pct(sub.score, assessment.maxScore));
  return `<span class="badge badge-amber">Submitted${sub.late ? ' (late)' : ''} — awaiting grade</span>`;
}
