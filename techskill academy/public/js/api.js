/** API client + auth session storage. */

const API_BASE = '/api';
const AUTH_KEY = 'tsa_auth';

let TOKEN = null;
let USER = null;

export function initAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      TOKEN = parsed.token || null;
      USER = parsed.user || null;
    }
  } catch { /* ignore */ }
}

export const auth = () => ({ token: TOKEN, user: USER });
export const isLoggedIn = () => !!TOKEN;

export function setAuth(token, user) {
  TOKEN = token;
  USER = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
}

export function updateUser(user) {
  USER = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token: TOKEN, user }));
}

export function logout() {
  TOKEN = null;
  USER = null;
  localStorage.removeItem(AUTH_KEY);
}

/** JSON API call with auth + error handling. Throws Error(message) on failure. */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Network error — please check your connection and try again.');
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    logout();
    window.location.hash = '#/';
    throw new Error('Your session has expired. Please sign in again.');
  }

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status}).`);
  return data;
}

// ---------- authenticated file access ----------

const objectUrls = new Map();

/** Fetch a stored file (passport photo, material, submission) with auth and return a blob URL. */
export async function fileUrl(key) {
  if (!key) return null;
  if (objectUrls.has(key)) return objectUrls.get(key);
  const res = await fetch(`${API_BASE}/files/${key}`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
  });
  if (!res.ok) throw new Error('Could not load file.');
  const url = URL.createObjectURL(await res.blob());
  objectUrls.set(key, url);
  return url;
}

/** Trigger a download of a stored file. */
export async function downloadFile(key, name) {
  const url = await fileUrl(key);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
