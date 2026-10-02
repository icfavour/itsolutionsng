/**
 * Authentication: password hashing (PBKDF2) + HMAC-signed session tokens.
 *
 * IMPORTANT: set a strong AUTH_SECRET environment variable on Netlify
 * (Site configuration → Environment variables) before going live.
 */
import crypto from 'node:crypto';
import { HttpError } from './http.mjs';
import { db } from './store.mjs';

const SECRET = process.env.AUTH_SECRET || 'tsa-dev-secret-change-me';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------- passwords ----------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    const test = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256');
    return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// ---------- tokens (compact JWT-style) ----------

const b64url = (input) => Buffer.from(input).toString('base64url');

export function signToken(payload) {
  const data = b64url(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  try {
    const [data, sig] = String(token).split('.');
    if (!data || !sig) return null;
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function tokenFromRequest(req) {
  const header = req.headers.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

/** Resolve the authenticated user (throws 401) — used by the router. */
export async function requireUser(req) {
  const token = tokenFromRequest(req);
  if (!token) throw new HttpError(401, 'Please sign in to continue.');
  const payload = verifyToken(token);
  if (!payload?.uid) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  const user = await db.getJSON(`users:${payload.uid}`);
  if (!user) throw new HttpError(401, 'Account not found.');
  return user;
}
