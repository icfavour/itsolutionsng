/** Student portal endpoints. */
import { HttpError, required, nowIso } from './http.mjs';
import {
  publicUser, getClass, getClasses, classView, materialsForClass, assessmentsForClass,
  getSubmission, saveFile, deleteFileByKey,
} from './helpers.mjs';

async function myClassesWithDetails(studentId) {
  const classes = (await getClasses()).filter((c) => Array.isArray(c.enrolled) && c.enrolled.includes(studentId));
  const out = [];
  for (const cls of classes) {
    const [view, materials, assessments] = await Promise.all([
      classView(cls),
      materialsForClass(cls.id),
      assessmentsForClass(cls.id),
    ]);
    const withSubmissions = [];
    for (const a of assessments) {
      const mySubmission = await getSubmission(a.id, studentId);
      withSubmissions.push({ ...a, mySubmission });
    }
    out.push({ ...view, materials, assessments: withSubmissions });
  }
  return out;
}

export async function studentOverview({ user }) {
  const myClasses = await myClassesWithDetails(user.id);

  const allClasses = await getClasses();
  const available = [];
  for (const cls of allClasses) {
    if (Array.isArray(cls.enrolled) && cls.enrolled.includes(user.id)) continue;
    available.push(await classView(cls));
  }

  // stats
  const allAssessments = myClasses.flatMap((c) => c.assessments);
  const graded = allAssessments.filter((a) => a.mySubmission?.score != null);
  const submitted = allAssessments.filter((a) => a.mySubmission && a.mySubmission.score == null);
  const notSubmitted = allAssessments.filter((a) => !a.mySubmission);
  const pcts = graded.map((a) => (a.maxScore > 0 ? (a.mySubmission.score / a.maxScore) * 100 : 0));
  const avg = pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) : null;

  return {
    student: publicUser(user),
    classes: myClasses,
    availableClasses: available,
    stats: {
      enrolled: myClasses.length,
      graded: graded.length,
      awaitingGrading: submitted.length,
      notSubmitted: notSubmitted.length,
      averageScore: avg,
    },
  };
}

export async function enroll({ user, body }) {
  required(body, 'classId');
  const cls = await getClass(body.classId);
  if (!cls) throw new HttpError(404, 'Class not found.');
  if (Array.isArray(cls.enrolled) && cls.enrolled.includes(user.id)) {
    throw new HttpError(409, 'You are already enrolled in this class.');
  }
  cls.enrolled = [...(cls.enrolled || []), user.id];
  await (await import('./store.mjs')).db.setJSON(`class:${cls.id}`, cls);
  return { ok: true, message: `Enrolled in ${cls.title}.` };
}

export async function dropClass({ user, body }) {
  required(body, 'classId');
  const cls = await getClass(body.classId);
  if (!cls) throw new HttpError(404, 'Class not found.');
  cls.enrolled = (cls.enrolled || []).filter((id) => id !== user.id);
  await (await import('./store.mjs')).db.setJSON(`class:${cls.id}`, cls);
  return { ok: true, message: `You have left ${cls.title}.` };
}

export async function submitAssessment({ user, body }) {
  required(body, 'assessmentId');
  const assessment = await (await import('./helpers.mjs')).getAssessment(body.assessmentId);
  if (!assessment) throw new HttpError(404, 'Assessment not found.');

  const cls = await getClass(assessment.classId);
  if (!cls || !(cls.enrolled || []).includes(user.id)) {
    throw new HttpError(403, 'You are not enrolled in the class for this assessment.');
  }

  const existing = await getSubmission(assessment.id, user.id);
  if (existing?.score != null) {
    throw new HttpError(409, 'This assessment has already been graded and is now locked.');
  }

  let fileKey = null;
  let fileName = null;
  if (body.file && body.file.dataBase64) {
    const rec = await saveFile(body.file, user.id);
    fileKey = rec.key;
    fileName = rec.name;
    if (existing?.fileKey) await deleteFileByKey(existing.fileKey);
  }

  const late = assessment.dueDate
    ? Date.now() > new Date(assessment.dueDate + 'T23:59:59').getTime()
    : false;

  const submission = {
    id: `${assessment.id}:${user.id}`,
    assessmentId: assessment.id,
    classId: assessment.classId,
    studentId: user.id,
    content: String(body.content || '').trim().slice(0, 8000),
    fileKey,
    fileName,
    submittedAt: nowIso(),
    late,
    score: null,
    feedback: null,
    gradedAt: null,
    gradedBy: null,
  };
  await (await import('./store.mjs')).db.setJSON(`submission:${submission.id}`, submission);
  return { ok: true, submission };
}
