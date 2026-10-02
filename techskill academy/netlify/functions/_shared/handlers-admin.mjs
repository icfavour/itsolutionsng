/** Admin portal endpoints. */
import { HttpError, required, isEmail, nowIso } from './http.mjs';
import { db } from './store.mjs';
import { hashPassword } from './auth.mjs';
import {
  publicUser, allUsers, findUserByEmail, saveUser, deleteUser,
  getCourses, getClasses, classView, getClass, deleteClassCascade, deleteFileByKey,
  allSubmissions, newUserId, newClassId, nextMatricNo, LEVELS,
} from './helpers.mjs';

// ---------- overview ----------

export async function adminOverview() {
  const [students, facilitators, classes, messages] = await Promise.all([
    allUsers('student'),
    allUsers('facilitator'),
    getClasses(),
    db.listJSON('message:'),
  ]);
  const sortedMessages = messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sortedStudents = students.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    counts: {
      students: students.length,
      facilitators: facilitators.length,
      classes: classes.length,
      unreadMessages: messages.filter((m) => !m.read).length,
    },
    recentMessages: sortedMessages.slice(0, 5),
    recentStudents: sortedStudents.slice(0, 5).map(publicUser),
  };
}

// ---------- students ----------

async function studentWithClasses(student) {
  const classes = (await getClasses()).filter((c) => (c.enrolled || []).includes(student.id));
  return { ...publicUser(student), classCount: classes.length, classTitles: classes.map((c) => c.title) };
}

export async function listStudents() {
  const students = (await allUsers('student')).sort((a, b) => a.name.localeCompare(b.name));
  return { students: await Promise.all(students.map(studentWithClasses)) };
}

export async function createStudent({ body }) {
  required(body, 'name', 'email');
  if (!isEmail(body.email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (await findUserByEmail(body.email)) throw new HttpError(409, 'A user with this email already exists.');
  const student = {
    id: newUserId(),
    role: 'student',
    name: String(body.name).trim().slice(0, 120),
    email: String(body.email).trim().toLowerCase(),
    phone: String(body.phone || '').trim().slice(0, 40),
    dob: body.dob ? String(body.dob).slice(0, 12) : null,
    gender: body.gender ? String(body.gender).slice(0, 20) : null,
    address: String(body.address || '').trim().slice(0, 300),
    guardianName: String(body.guardianName || '').trim().slice(0, 120),
    guardianPhone: String(body.guardianPhone || '').trim().slice(0, 40),
    matricNo: await nextMatricNo(),
    photoKey: null,
    passwordHash: hashPassword(body.password && String(body.password).length >= 6 ? body.password : 'Student@123'),
    createdAt: nowIso(),
  };
  await saveUser(student);
  return { ok: true, student: await studentWithClasses(student), message: `Student created. Matric No: ${student.matricNo}` };
}

const STUDENT_FIELDS = ['name', 'phone', 'dob', 'gender', 'address', 'guardianName', 'guardianPhone'];

export async function updateStudent({ params, body }) {
  const student = await db.getJSON(`users:${params.id}`);
  if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found.');

  for (const field of STUDENT_FIELDS) {
    if (body[field] !== undefined) student[field] = String(body[field]).trim().slice(0, 300);
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
    const existing = await findUserByEmail(email);
    if (existing && existing.id !== student.id) throw new HttpError(409, 'A user with this email already exists.');
    await db.delete(`users:email:${student.email.toLowerCase()}`);
    student.email = email;
  }
  await saveUser(student);
  return { ok: true, student: await studentWithClasses(student) };
}

export async function deleteStudent({ params }) {
  const student = await db.getJSON(`users:${params.id}`);
  if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found.');
  // remove from classes
  for (const cls of await getClasses()) {
    if ((cls.enrolled || []).includes(student.id)) {
      cls.enrolled = cls.enrolled.filter((id) => id !== student.id);
      await db.setJSON(`class:${cls.id}`, cls);
    }
  }
  // remove submissions
  for (const s of await allSubmissions()) {
    if (s.studentId === student.id) {
      await deleteFileByKey(s.fileKey);
      await db.delete(`submission:${s.assessmentId}:${s.studentId}`);
    }
  }
  await deleteUser(student);
  return { ok: true, message: `${student.name} has been removed.` };
}

async function resetPassword(user, newPassword) {
  if (String(newPassword).length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  user.passwordHash = hashPassword(newPassword);
  await saveUser(user);
  return { ok: true, message: 'Password has been reset.' };
}

export async function resetStudentPassword({ params, body }) {
  required(body, 'newPassword');
  const student = await db.getJSON(`users:${params.id}`);
  if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found.');
  return resetPassword(student, body.newPassword);
}

// ---------- facilitators ----------

async function facilitatorWithClasses(f) {
  const classes = (await getClasses()).filter((c) => c.facilitatorId === f.id);
  return { ...publicUser(f), classCount: classes.length, classTitles: classes.map((c) => c.title) };
}

export async function listFacilitators() {
  const facilitators = (await allUsers('facilitator')).sort((a, b) => a.name.localeCompare(b.name));
  return { facilitators: await Promise.all(facilitators.map(facilitatorWithClasses)) };
}

export async function createFacilitator({ body }) {
  required(body, 'name', 'email');
  if (!isEmail(body.email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (await findUserByEmail(body.email)) throw new HttpError(409, 'A user with this email already exists.');
  const facilitator = {
    id: newUserId(),
    role: 'facilitator',
    name: String(body.name).trim().slice(0, 120),
    email: String(body.email).trim().toLowerCase(),
    phone: String(body.phone || '').trim().slice(0, 40),
    expertise: String(body.expertise || '').trim().slice(0, 160),
    bio: String(body.bio || '').trim().slice(0, 1000),
    photoKey: null,
    passwordHash: hashPassword(body.password && String(body.password).length >= 6 ? body.password : 'Facilitator@123'),
    createdAt: nowIso(),
  };
  await saveUser(facilitator);
  return { ok: true, facilitator: await facilitatorWithClasses(facilitator) };
}

const FACILITATOR_FIELDS = ['name', 'phone', 'expertise', 'bio'];

export async function updateFacilitator({ params, body }) {
  const f = await db.getJSON(`users:${params.id}`);
  if (!f || f.role !== 'facilitator') throw new HttpError(404, 'Facilitator not found.');
  for (const field of FACILITATOR_FIELDS) {
    if (body[field] !== undefined) f[field] = String(body[field]).trim().slice(0, 1000);
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
    const existing = await findUserByEmail(email);
    if (existing && existing.id !== f.id) throw new HttpError(409, 'A user with this email already exists.');
    await db.delete(`users:email:${f.email.toLowerCase()}`);
    f.email = email;
  }
  await saveUser(f);
  return { ok: true, facilitator: await facilitatorWithClasses(f) };
}

export async function deleteFacilitator({ params }) {
  const f = await db.getJSON(`users:${params.id}`);
  if (!f || f.role !== 'facilitator') throw new HttpError(404, 'Facilitator not found.');
  for (const cls of await getClasses()) {
    if (cls.facilitatorId === f.id) {
      cls.facilitatorId = null;
      await db.setJSON(`class:${cls.id}`, cls);
    }
  }
  await deleteUser(f);
  return { ok: true, message: `${f.name} has been removed.` };
}

export async function resetFacilitatorPassword({ params, body }) {
  required(body, 'newPassword');
  const f = await db.getJSON(`users:${params.id}`);
  if (!f || f.role !== 'facilitator') throw new HttpError(404, 'Facilitator not found.');
  return resetPassword(f, body.newPassword);
}

// ---------- classes ----------

export async function listClasses() {
  const classes = await getClasses();
  const out = [];
  for (const cls of classes) {
    const students = [];
    for (const studentId of cls.enrolled || []) {
      const s = await db.getJSON(`users:${studentId}`);
      if (s) students.push({ id: s.id, name: s.name, matricNo: s.matricNo, email: s.email, photoKey: s.photoKey });
    }
    out.push({ ...(await classView(cls)), students });
  }
  out.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  return { classes: out };
}

function validateClassBody(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.courseId !== undefined) {
    if (!body.courseId) errors.push('course is required');
  }
  if (!partial || body.title !== undefined) {
    if (!String(body.title || '').trim()) errors.push('title is required');
  }
  if (!partial || body.level !== undefined) {
    if (body.level && !LEVELS.includes(body.level)) errors.push('invalid level');
  }
  if (errors.length) throw new HttpError(400, errors.join('; '));
}

export async function createClass({ body }) {
  validateClassBody(body);
  const courses = await getCourses();
  const course = courses.find((c) => c.id === body.courseId);
  if (!course) throw new HttpError(400, 'Unknown course.');
  if (body.facilitatorId) {
    const f = await db.getJSON(`users:${body.facilitatorId}`);
    if (!f || f.role !== 'facilitator') throw new HttpError(400, 'Selected facilitator was not found.');
  }
  const cls = {
    id: newClassId(),
    courseId: body.courseId,
    level: LEVELS.includes(body.level) ? body.level : 'Beginner',
    title: String(body.title).trim().slice(0, 200),
    schedule: String(body.schedule || '').trim().slice(0, 200),
    startDate: body.startDate ? String(body.startDate).slice(0, 12) : null,
    endDate: body.endDate ? String(body.endDate).slice(0, 12) : null,
    description: String(body.description || '').trim().slice(0, 1000),
    facilitatorId: body.facilitatorId || null,
    enrolled: [],
    createdAt: nowIso(),
  };
  await db.setJSON(`class:${cls.id}`, cls);
  return { ok: true, class: await classView(cls) };
}

export async function updateClass({ params, body }) {
  const cls = await getClass(params.id);
  if (!cls) throw new HttpError(404, 'Class not found.');
  validateClassBody(body, { partial: true });
  const strFields = ['title', 'schedule', 'description'];
  for (const f of strFields) {
    if (body[f] !== undefined) cls[f] = String(body[f]).trim().slice(0, 1000);
  }
  if (body.courseId !== undefined) {
    const course = (await getCourses()).find((c) => c.id === body.courseId);
    if (!course) throw new HttpError(400, 'Unknown course.');
    cls.courseId = body.courseId;
  }
  if (body.level !== undefined && LEVELS.includes(body.level)) cls.level = body.level;
  if (body.facilitatorId !== undefined) {
    if (body.facilitatorId) {
      const f = await db.getJSON(`users:${body.facilitatorId}`);
      if (!f || f.role !== 'facilitator') throw new HttpError(400, 'Selected facilitator was not found.');
    }
    cls.facilitatorId = body.facilitatorId || null;
  }
  if (body.startDate !== undefined) cls.startDate = body.startDate || null;
  if (body.endDate !== undefined) cls.endDate = body.endDate || null;
  await db.setJSON(`class:${cls.id}`, cls);
  return { ok: true, class: await classView(cls) };
}

export async function deleteClass({ params }) {
  const cls = await getClass(params.id);
  if (!cls) throw new HttpError(404, 'Class not found.');
  await deleteClassCascade(cls.id);
  return { ok: true, message: 'Class and all its materials, assessments and grades were deleted.' };
}

// ---------- enrollment management ----------

export async function adminEnroll({ body }) {
  required(body, 'studentId', 'classId');
  const student = await db.getJSON(`users:${body.studentId}`);
  if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found.');
  const cls = await getClass(body.classId);
  if (!cls) throw new HttpError(404, 'Class not found.');
  if (!(cls.enrolled || []).includes(student.id)) {
    cls.enrolled = [...(cls.enrolled || []), student.id];
    await db.setJSON(`class:${cls.id}`, cls);
  }
  return { ok: true, message: `${student.name} enrolled in ${cls.title}.` };
}

export async function adminUnenroll({ params }) {
  const cls = await getClass(params.classId);
  if (!cls) throw new HttpError(404, 'Class not found.');
  const student = await db.getJSON(`users:${params.studentId}`);
  if (!student) throw new HttpError(404, 'Student not found.');
  cls.enrolled = (cls.enrolled || []).filter((id) => id !== params.studentId);
  await db.setJSON(`class:${cls.id}`, cls);
  // clean up that student's submissions for this class
  for (const s of await allSubmissions()) {
    if (s.classId === cls.id && s.studentId === params.studentId) {
      await deleteFileByKey(s.fileKey);
      await db.delete(`submission:${s.assessmentId}:${s.studentId}`);
    }
  }
  return { ok: true, message: `${student.name} removed from ${cls.title}.` };
}

// ---------- messages ----------

export async function listMessages() {
  const messages = (await db.listJSON('message:')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { messages };
}

export async function updateMessage({ params, body }) {
  const message = await db.getJSON(`message:${params.id}`);
  if (!message) throw new HttpError(404, 'Message not found.');
  if (body.read !== undefined) message.read = !!body.read;
  await db.setJSON(`message:${message.id}`, message);
  return { ok: true, message };
}

export async function deleteMessage({ params }) {
  const message = await db.getJSON(`message:${params.id}`);
  if (!message) throw new HttpError(404, 'Message not found.');
  await db.delete(`message:${message.id}`);
  return { ok: true };
}
