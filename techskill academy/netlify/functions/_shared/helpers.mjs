/** Shared data-access helpers used across API handlers. */
import crypto from 'node:crypto';
import { HttpError } from './http.mjs';
import { db } from './store.mjs';

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
export const ASSESSMENT_TYPES = ['Quiz', 'Assignment', 'Project', 'Exam'];

const uuid = () => crypto.randomUUID();
export const newUserId = () => 'u-' + uuid();
export const newClassId = () => 'cls-' + uuid().slice(0, 8);
export const newMaterialId = () => 'mat-' + uuid().slice(0, 8);
export const newAssessmentId = () => 'as-' + uuid().slice(0, 8);
export const newMessageId = () => 'msg-' + uuid().slice(0, 8);

/** Strip sensitive fields from a user record. */
export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function findUserByEmail(email) {
  const norm = String(email || '').toLowerCase().trim();
  const id = await db.getJSON(`users:email:${norm}`);
  if (!id) return null;
  return db.getJSON(`users:${id}`);
}

export async function saveUser(user) {
  await db.setJSON(`users:${user.id}`, user);
  await db.setJSON(`users:email:${user.email.toLowerCase()}`, user.id);
}

export async function deleteUser(user) {
  await db.delete(`users:${user.id}`);
  await db.delete(`users:email:${user.email.toLowerCase()}`);
  if (user.photoKey) await deleteFileByKey(user.photoKey);
}

export async function allUsers(role) {
  const all = await db.listJSON('users:');
  return all.filter((u) => u && typeof u === 'object' && u.role === role);
}

// ---------- courses & classes ----------

export const getCourses = () => db.listJSON('course:');
export const getClass = (id) => db.getJSON(`class:${id}`);
export const getClasses = () => db.listJSON('class:');

export async function classView(cls, { includeCounts = true } = {}) {
  if (!cls) return null;
  const courses = await getCourses();
  const course = courses.find((c) => c.id === cls.courseId) || {};
  const facilitator = cls.facilitatorId ? await db.getJSON(`users:${cls.facilitatorId}`) : null;
  return {
    ...cls,
    courseTitle: course.title || '',
    courseCode: course.code || '',
    facilitator: facilitator ? publicUser(facilitator) : null,
    enrolledCount: Array.isArray(cls.enrolled) ? cls.enrolled.length : 0,
  };
}

export async function materialsForClass(classId) {
  const all = await db.listJSON('material:');
  return all.filter((m) => m.classId === classId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function assessmentsForClass(classId) {
  const all = await db.listJSON('assessment:');
  return all.filter((a) => a.classId === classId).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
}

export async function getAssessment(id) {
  return db.getJSON(`assessment:${id}`);
}

// ---------- submissions ----------

export const submissionKey = (assessmentId, studentId) => `submission:${assessmentId}:${studentId}`;

export async function getSubmission(assessmentId, studentId) {
  return db.getJSON(submissionKey(assessmentId, studentId));
}

export async function allSubmissions() {
  return db.listJSON('submission:');
}

// ---------- files (stored as base64 in the datastore) ----------

const MAX_BASE64 = 6_000_000; // ~4.4 MB binary

export async function saveFile({ name, contentType, dataBase64 }, uploadedBy) {
  if (!dataBase64) throw new HttpError(400, 'File data is missing.');
  if (String(dataBase64).length > MAX_BASE64) {
    throw new HttpError(413, 'File is too large. Maximum size is 4 MB.');
  }
  const key = 'f' + crypto.randomBytes(9).toString('hex');
  const record = {
    key,
    name: String(name || 'file'),
    contentType: String(contentType || 'application/octet-stream'),
    size: Math.floor((String(dataBase64).length * 3) / 4),
    uploadedBy: uploadedBy || null,
    uploadedAt: new Date().toISOString(),
  };
  await db.setJSON(`file:${key}`, { ...record, dataBase64: String(dataBase64) });
  return record;
}

export const getFileRecord = (key) => db.getJSON(`file:${key}`);

export async function deleteFileByKey(key) {
  if (key) await db.delete(`file:${key}`);
}

// ---------- misc ----------

export async function nextMatricNo() {
  const seq = (await db.getJSON('meta:matricSeq', 0)) + 1;
  await db.setJSON('meta:matricSeq', seq);
  return `TSA/${new Date().getFullYear()}/${String(seq).padStart(4, '0')}`;
}

/** Delete a class and everything attached to it (materials, assessments, submissions). */
export async function deleteClassCascade(classId) {
  const materials = await materialsForClass(classId);
  for (const m of materials) {
    await deleteFileByKey(m.fileKey);
    await db.delete(`material:${m.id}`);
  }
  const assessments = await assessmentsForClass(classId);
  const submissions = await allSubmissions();
  for (const a of assessments) {
    for (const s of submissions) {
      if (s.assessmentId === a.id) {
        await deleteFileByKey(s.fileKey);
        await db.delete(submissionKey(a.id, s.studentId));
      }
    }
    await db.delete(`assessment:${a.id}`);
  }
  await db.delete(`class:${classId}`);
}
