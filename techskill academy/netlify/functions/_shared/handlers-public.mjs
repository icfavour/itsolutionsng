/** Public (unauthenticated) endpoints. */
import { HttpError, required, isEmail, nowIso } from './http.mjs';
import { db } from './store.mjs';
import { verifyPassword, signToken, hashPassword } from './auth.mjs';
import {
  publicUser, findUserByEmail, allUsers, getCourses, getClasses, classView,
  newMessageId, newUserId, saveUser, nextMatricNo,
} from './helpers.mjs';

// ---------- student self-signup (light per-IP rate limit) ----------

const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SIGNUP_MAX_PER_WINDOW = 5;
const signupAttempts = new Map();

function rateLimitSignup(req) {
  const ip = String(
    req.headers.get('x-nf-client-connection-ip')
    || (req.headers.get('x-forwarded-for') || '').split(',')[0]
    || 'unknown',
  ).trim();
  const now = Date.now();
  const hits = (signupAttempts.get(ip) || []).filter((t) => now - t < SIGNUP_WINDOW_MS);
  if (hits.length >= SIGNUP_MAX_PER_WINDOW) {
    throw new HttpError(429, 'Too many accounts created from this device. Please try again in a little while.');
  }
  hits.push(now);
  signupAttempts.set(ip, hits);
}

/** Public student self-registration → returns a session token (auto sign-in). */
export async function signup({ body, req }) {
  required(body, 'name', 'email', 'password');
  if (!isEmail(body.email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (String(body.password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (await findUserByEmail(body.email)) {
    throw new HttpError(409, 'An account with this email already exists. Please sign in instead.');
  }
  rateLimitSignup(req);

  const student = {
    id: newUserId(),
    role: 'student',
    name: String(body.name).trim().slice(0, 120),
    email: String(body.email).trim().toLowerCase(),
    phone: String(body.phone || '').trim().slice(0, 40),
    dob: null,
    gender: null,
    address: '',
    guardianName: '',
    guardianPhone: '',
    matricNo: await nextMatricNo(),
    photoKey: null,
    passwordHash: hashPassword(String(body.password)),
    createdAt: nowIso(),
  };
  await saveUser(student);
  const token = signToken({ uid: student.id, role: 'student' });
  return {
    token,
    user: publicUser(student),
    message: `Welcome to TechSkill Academy! Your matric number is ${student.matricNo}.`,
  };
}

export async function login({ body }) {
  required(body, 'email', 'password');
  const user = await findUserByEmail(body.email);
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  const token = signToken({ uid: user.id, role: user.role });
  return { token, user: publicUser(user) };
}

export async function publicSummary() {
  const [students, facilitators, classes] = await Promise.all([
    allUsers('student'),
    allUsers('facilitator'),
    getClasses(),
  ]);
  return {
    students: students.length,
    facilitators: facilitators.length,
    classes: classes.length,
    courses: (await getCourses()).length,
  };
}

export async function publicCourses() {
  const [courses, classes] = await Promise.all([getCourses(), getClasses()]);
  const withClasses = [];
  for (const course of courses) {
    const cls = (await Promise.all(classes.filter((c) => c.courseId === course.id).map((c) => classView(c))))
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    withClasses.push({ ...course, classes: cls });
  }
  return { courses: withClasses };
}

export async function contactSubmit({ body }) {
  required(body, 'name', 'email', 'message');
  if (!isEmail(body.email)) throw new HttpError(400, 'Please enter a valid email address.');
  const message = {
    id: newMessageId(),
    name: String(body.name).trim().slice(0, 120),
    email: String(body.email).trim().toLowerCase().slice(0, 160),
    phone: String(body.phone || '').trim().slice(0, 40),
    subject: String(body.subject || 'General enquiry').trim().slice(0, 140),
    message: String(body.message).trim().slice(0, 4000),
    read: false,
    createdAt: nowIso(),
  };
  await db.setJSON(`message:${message.id}`, message);
  return { ok: true, message: 'Thank you! Your message has been received — we will get back to you shortly.' };
}
