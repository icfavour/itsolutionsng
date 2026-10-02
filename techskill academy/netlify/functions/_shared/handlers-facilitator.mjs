/** Facilitator portal endpoints. */
import { HttpError, required, nowIso } from './http.mjs';
import { db } from './store.mjs';
import {
  publicUser, getClass, getClasses, classView, materialsForClass, assessmentsForClass,
  getAssessment, allSubmissions, saveFile, deleteFileByKey, newMaterialId, newAssessmentId,
  ASSESSMENT_TYPES,
} from './helpers.mjs';

async function myClasses(facilitatorId) {
  return (await getClasses()).filter((c) => c.facilitatorId === facilitatorId);
}

async function assertOwnClass(facilitator, classId) {
  const cls = await getClass(classId);
  if (!cls) throw new HttpError(404, 'Class not found.');
  if (cls.facilitatorId !== facilitator.id) {
    throw new HttpError(403, 'You can only manage classes assigned to you.');
  }
  return cls;
}

async function studentsInClasses(classIds) {
  const seen = new Map();
  for (const classId of classIds) {
    const cls = await getClass(classId);
    for (const studentId of cls?.enrolled || []) {
      if (!seen.has(studentId)) {
        const student = await db.getJSON(`users:${studentId}`);
        if (student && student.role === 'student') seen.set(studentId, student);
      }
    }
  }
  return [...seen.values()];
}

export async function facilitatorOverview({ user }) {
  const classes = await myClasses(user.id);
  const classIds = classes.map((c) => c.id);

  const students = await studentsInClasses(classIds);
  const myAssessments = [];
  for (const classId of classIds) myAssessments.push(...(await assessmentsForClass(classId)));
  const myMaterials = [];
  for (const classId of classIds) myMaterials.push(...(await materialsForClass(classId)));

  const submissions = (await allSubmissions()).filter((s) => classIds.includes(s.classId));
  const awaiting = submissions.filter((s) => s.score == null);
  const graded = submissions.filter((s) => s.score != null);

  // recent submissions (newest first) joined with student + assessment
  const recent = [...submissions]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 6);
  const recentJoined = [];
  for (const s of recent) {
    const student = await db.getJSON(`users:${s.studentId}`);
    const assessment = await getAssessment(s.assessmentId);
    if (student && assessment) {
      recentJoined.push({
        ...s,
        studentName: student.name,
        matricNo: student.matricNo,
        assessmentTitle: assessment.title,
        maxScore: assessment.maxScore,
      });
    }
  }

  const classesView = [];
  for (const cls of classes) classesView.push(await classView(cls));

  return {
    facilitator: publicUser(user),
    classes: classesView,
    recentSubmissions: recentJoined,
    stats: {
      classes: classes.length,
      students: students.length,
      materials: myMaterials.length,
      awaitingGrading: awaiting.length,
      graded: graded.length,
    },
  };
}

export async function uploadMaterial({ user, body }) {
  required(body, 'classId', 'title', 'file');
  const cls = await assertOwnClass(user, body.classId);
  const { name, contentType, dataBase64 } = body.file || {};
  const rec = await saveFile({ name, contentType, dataBase64 }, user.id);
  const material = {
    id: newMaterialId(),
    classId: cls.id,
    title: String(body.title).trim().slice(0, 200),
    description: String(body.description || '').trim().slice(0, 1000),
    fileName: rec.name,
    fileType: rec.contentType,
    size: rec.size,
    fileKey: rec.key,
    uploadedBy: user.id,
    uploadedAt: nowIso(),
  };
  await db.setJSON(`material:${material.id}`, material);
  return { ok: true, material };
}

export async function deleteMaterial({ user, params }) {
  const material = await db.getJSON(`material:${params.id}`);
  if (!material) throw new HttpError(404, 'Material not found.');
  const cls = await getClass(material.classId);
  if (!cls || cls.facilitatorId !== user.id) throw new HttpError(403, 'You can only delete your own materials.');
  await deleteFileByKey(material.fileKey);
  await db.delete(`material:${material.id}`);
  return { ok: true };
}

export async function createAssessment({ user, body }) {
  required(body, 'classId', 'title', 'type', 'maxScore');
  const cls = await assertOwnClass(user, body.classId);
  if (!ASSESSMENT_TYPES.includes(body.type)) throw new HttpError(400, 'Invalid assessment type.');
  const maxScore = Number(body.maxScore);
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) {
    throw new HttpError(400, 'Max score must be a number between 1 and 1000.');
  }
  const assessment = {
    id: newAssessmentId(),
    classId: cls.id,
    title: String(body.title).trim().slice(0, 200),
    type: body.type,
    maxScore: Math.round(maxScore),
    dueDate: body.dueDate ? String(body.dueDate).slice(0, 12) : null,
    createdBy: user.id,
    createdAt: nowIso(),
  };
  await db.setJSON(`assessment:${assessment.id}`, assessment);
  return { ok: true, assessment };
}

export async function deleteAssessment({ user, params }) {
  const assessment = await getAssessment(params.id);
  if (!assessment) throw new HttpError(404, 'Assessment not found.');
  const cls = await getClass(assessment.classId);
  if (!cls || cls.facilitatorId !== user.id) throw new HttpError(403, 'You can only delete assessments in your classes.');
  const submissions = (await allSubmissions()).filter((s) => s.assessmentId === assessment.id);
  for (const s of submissions) {
    await deleteFileByKey(s.fileKey);
    await db.delete(`submission:${assessment.id}:${s.studentId}`);
  }
  await db.delete(`assessment:${assessment.id}`);
  return { ok: true };
}

/** All submissions across the facilitator's classes (joined for display). */
export async function listSubmissions({ user, query }) {
  const classes = await myClasses(user.id);
  const classIds = classes.map((c) => c.id);
  const status = query.status || 'all';

  const rows = [];
  for (const s of await allSubmissions()) {
    if (!classIds.includes(s.classId)) continue;
    const [student, assessment, cls] = await Promise.all([
      db.getJSON(`users:${s.studentId}`),
      getAssessment(s.assessmentId),
      getClass(s.classId),
    ]);
    if (!student || !assessment) continue;
    if (status === 'pending' && s.score != null) continue;
    if (status === 'graded' && s.score == null) continue;
    rows.push({
      ...s,
      studentName: student.name,
      matricNo: student.matricNo,
      photoKey: student.photoKey,
      assessmentTitle: assessment.title,
      assessmentType: assessment.type,
      maxScore: assessment.maxScore,
      classTitle: cls?.title || '',
    });
  }
  rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return { submissions: rows };
}

export async function gradeSubmission({ user, body }) {
  required(body, 'submissionId', 'score');
  const submission = await db.getJSON(`submission:${body.submissionId}`);
  if (!submission) throw new HttpError(404, 'Submission not found.');
  const assessment = await getAssessment(submission.assessmentId);
  const cls = assessment ? await getClass(assessment.classId) : null;
  const allowed = user.role === 'admin' || (cls && cls.facilitatorId === user.id);
  if (!allowed) throw new HttpError(403, 'You can only grade submissions for your classes.');

  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > assessment.maxScore) {
    throw new HttpError(400, `Score must be between 0 and ${assessment.maxScore}.`);
  }
  submission.score = score;
  submission.feedback = String(body.feedback || '').trim().slice(0, 2000);
  submission.gradedAt = nowIso();
  submission.gradedBy = user.id;
  await db.setJSON(`submission:${submission.id}`, submission);
  return { ok: true, submission };
}

export async function listMyStudents({ user }) {
  const classes = await myClasses(user.id);
  const students = await studentsInClasses(classes.map((c) => c.id));
  const out = [];
  for (const student of students) {
    const enrolledIn = classes.filter((c) => (c.enrolled || []).includes(student.id));
    out.push({ ...publicUser(student), myClasses: enrolledIn.map((c) => ({ id: c.id, title: c.title })) });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return { students: out };
}

export async function studentDetail({ user, params }) {
  const student = await db.getJSON(`users:${params.id}`);
  if (!student || student.role !== 'student') throw new HttpError(404, 'Student not found.');
  const classes = await myClasses(user.id);
  const results = [];
  let sum = 0;
  let count = 0;
  for (const cls of classes) {
    if (!(cls.enrolled || []).includes(student.id)) continue;
    for (const a of await assessmentsForClass(cls.id)) {
      const sub = await db.getJSON(`submission:${a.id}:${student.id}`);
      const pct = sub?.score != null && a.maxScore > 0 ? Math.round((sub.score / a.maxScore) * 100) : null;
      if (pct != null) { sum += pct; count += 1; }
      results.push({
        classTitle: cls.title,
        assessmentTitle: a.title,
        type: a.type,
        maxScore: a.maxScore,
        score: sub?.score ?? null,
        pct,
        feedback: sub?.feedback || null,
        submitted: !!sub,
        gradedAt: sub?.gradedAt || null,
      });
    }
  }
  return {
    student: publicUser(student),
    results,
    average: count ? Math.round(sum / count) : null,
  };
}
