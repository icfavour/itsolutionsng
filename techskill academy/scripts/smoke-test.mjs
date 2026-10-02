/**
 * Smoke test — end-to-end API test against a running server.
 * Creates everything it needs via the API (student self-signup, facilitator,
 * class) and cleans up after itself — so it works identically on a fresh
 * production deployment and on a demo-seeded local instance.
 *
 *   node server.mjs                                  (in one terminal)
 *   node scripts/smoke-test.mjs http://localhost:3000
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const STAMP = Date.now();

let passed = 0;
let failed = 0;

function ok(name, cond, extra = '') {
  if (cond) { passed += 1; console.log(`  ✔ ${name}`); }
  else { failed += 1; console.log(`  ✘ ${name} ${extra}`); }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + '/api/' + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function main() {
  console.log(`\nSmoke-testing ${BASE} …\n`);

  // ---------- public ----------
  console.log('Public endpoints');
  let r = await call('public/summary');
  ok('GET public/summary', r.status === 200 && r.data.courses === 6, JSON.stringify(r.data));

  r = await call('public/courses');
  ok('GET public/courses', r.status === 200 && r.data.courses.length === 6);

  r = await call('public/contact', { method: 'POST', body: { name: 'Smoke Test', email: `smoke-${STAMP}@example.com`, message: 'Hello from the smoke test.' } });
  ok('POST public/contact', r.status === 200 && r.data.ok === true);

  r = await call('public/contact', { method: 'POST', body: { name: '', email: 'bad', message: '' } });
  ok('contact form validation rejects bad input', r.status === 400);

  // ---------- admin (always seeded) ----------
  console.log('\nAdmin account');
  r = await call('auth/login', { method: 'POST', body: { email: 'itsolutionsnoads@gmail.com', password: 'Admin@123' } });
  const adminToken = r.data?.token;
  ok('login as admin (seeded account)', r.status === 200 && !!adminToken, JSON.stringify(r.data));

  r = await call('admin/overview', { token: 'bogus.token.here' });
  ok('invalid token rejected', r.status === 401);

  r = await call('admin/overview', { token: adminToken });
  ok('GET admin/overview', r.status === 200 && typeof r.data.counts?.students === 'number');

  // ---------- student self-signup ----------
  console.log('\nStudent self-signup');
  const studentEmail = `smoke-student-${STAMP}@example.com`;
  r = await call('auth/signup', { method: 'POST', body: { name: 'Smoke Student', email: studentEmail, phone: '0800 111 2222', password: 'Starter@123' } });
  const studentToken = r.data?.token;
  const studentId = r.data?.user?.id;
  ok('signup creates a student account (auto sign-in)', r.status === 200 && !!studentToken && r.data.user.role === 'student', JSON.stringify(r.data));
  ok('matric number auto-generated', /^TSA\/\d{4}\/\d{4,}$/.test(r.data?.user?.matricNo || ''), r.data?.user?.matricNo);

  r = await call('auth/signup', { method: 'POST', body: { name: 'Duplicate', email: studentEmail, password: 'Starter@123' } });
  ok('duplicate email rejected (409)', r.status === 409);

  r = await call('auth/signup', { method: 'POST', body: { name: 'Weak Password', email: `weak-${STAMP}@example.com`, password: '123' } });
  ok('weak password rejected (400)', r.status === 400);

  r = await call('admin/overview', { token: studentToken });
  ok('role check — student cannot use admin API', r.status === 403);

  // ---------- admin sets up facilitator + class ----------
  console.log('\nAdmin: facilitator & class setup');
  r = await call('admin/facilitators', { method: 'POST', token: adminToken, body: { name: 'Smoke Facilitator', email: `smoke-fac-${STAMP}@example.com`, expertise: 'Testing', password: 'Fac@12345' } });
  const facilitatorId = r.data?.facilitator?.id;
  ok('create facilitator', r.status === 200 && !!facilitatorId, JSON.stringify(r.data));

  r = await call('auth/login', { method: 'POST', body: { email: `smoke-fac-${STAMP}@example.com`, password: 'Fac@12345' } });
  const facToken = r.data?.token;
  ok('facilitator can log in', r.status === 200 && !!facToken);

  r = await call('admin/classes', { method: 'POST', token: adminToken, body: { courseId: 'cctv', level: 'Beginner', title: `Smoke Class ${STAMP}`, schedule: 'Mon & Wed · 4:00 PM – 6:00 PM', facilitatorId } });
  const classId = r.data?.class?.id;
  ok('create class with facilitator assigned', r.status === 200 && !!classId, JSON.stringify(r.data));

  r = await call('admin/enroll', { method: 'POST', token: adminToken, body: { studentId, classId } });
  ok('admin enrolls the signed-up student', r.status === 200);

  // ---------- facilitator flow ----------
  console.log('\nFacilitator portal');
  r = await call('facilitator/overview', { token: facToken });
  ok('overview shows the assigned class', r.status === 200 && r.data.classes.some((c) => c.id === classId));

  const fileB64 = Buffer.from('# Smoke material\n\nUploaded by the smoke test.').toString('base64');
  r = await call('facilitator/materials', {
    method: 'POST', token: facToken,
    body: { classId, title: 'Smoke — Test Material', description: 'temporary', file: { name: 'smoke.md', contentType: 'text/markdown', dataBase64: fileB64 } },
  });
  const materialId = r.data?.material?.id;
  ok('upload course material', r.status === 200 && !!materialId);

  r = await call('facilitator/materials', {
    method: 'POST', token: facToken,
    body: { classId: 'cls-does-not-exist', title: 'x', file: { name: 'x', contentType: 'text/plain', dataBase64: fileB64 } },
  });
  ok('cannot upload to a class that is not theirs', r.status >= 400);

  r = await call('facilitator/assessments', {
    method: 'POST', token: facToken,
    body: { classId, title: 'Smoke — Test Quiz', type: 'Quiz', maxScore: 10, dueDate: '2026-12-01' },
  });
  const assessment = r.data?.assessment;
  ok('create assessment', r.status === 200 && !!assessment?.id);

  r = await call('facilitator/students', { token: facToken });
  ok('facilitator sees enrolled student', r.status === 200 && r.data.students.some((s) => s.id === studentId));

  // ---------- student flow ----------
  console.log('\nStudent portal');
  r = await call('student/overview', { token: studentToken });
  ok('overview shows the enrolled class', r.status === 200 && r.data.classes.some((c) => c.id === classId));

  r = await call('me', { method: 'PUT', token: studentToken, body: { name: 'Smoke Student II', phone: '0800 333 4444', gender: 'Male', address: 'Ikorodu, Lagos' } });
  ok('update own profile', r.status === 200 && r.data.user.name === 'Smoke Student II');

  r = await call('student/submit', { method: 'POST', token: studentToken, body: { assessmentId: assessment.id, content: 'My smoke-test answer.' } });
  ok('submit assessment', r.status === 200);

  r = await call('facilitator/submissions?status=pending', { token: facToken });
  const pending = (r.data?.submissions || []).find((s) => s.assessmentId === assessment.id);
  ok('submission appears in grading queue', !!pending);

  r = await call('facilitator/grade', {
    method: 'POST', token: facToken,
    body: { submissionId: `${assessment.id}:${pending.studentId}`, score: 9, feedback: 'Well done.' },
  });
  ok('grade submission', r.status === 200 && r.data.submission.score === 9);

  r = await call('student/submit', { method: 'POST', token: studentToken, body: { assessmentId: assessment.id, content: 'try again' } });
  ok('graded submission is locked (409)', r.status === 409);

  r = await call('student/overview', { token: studentToken });
  ok('student sees the graded result', r.status === 200
    && r.data.classes.some((c) => c.assessments.some((a) => a.id === assessment.id && a.mySubmission?.score === 9)));

  // passport photo + authenticated file access
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  r = await call('me/photo', { method: 'POST', token: studentToken, body: { file: { name: 'passport.png', contentType: 'image/png', dataBase64: tinyPng } } });
  const photoKey = r.data?.photoKey;
  ok('upload passport photo', r.status === 200 && !!photoKey);

  const fileRes = await fetch(`${BASE}/api/files/${photoKey}`, { headers: { authorization: `Bearer ${facToken}` } });
  ok('authenticated file download', fileRes.status === 200 && (fileRes.headers.get('content-type') || '').startsWith('image/'));

  const anonFile = await fetch(`${BASE}/api/files/${photoKey}`);
  ok('file download requires sign-in', anonFile.status === 401);

  // self-service password change
  r = await call('me/password', { method: 'PUT', token: studentToken, body: { currentPassword: 'Starter@123', newPassword: 'Changed@456' } });
  ok('change own password', r.status === 200);

  r = await call('auth/login', { method: 'POST', body: { email: studentEmail, password: 'Changed@456' } });
  ok('login with the new password', r.status === 200);

  r = await call('auth/login', { method: 'POST', body: { email: studentEmail, password: 'Starter@123' } });
  ok('old password rejected', r.status === 401);

  // ---------- cleanup ----------
  console.log('\nCleanup');
  r = await call(`admin/classes/${classId}`, { method: 'DELETE', token: adminToken });
  ok('delete class (cascades materials, assessments, grades)', r.status === 200);
  r = await call(`admin/facilitators/${facilitatorId}`, { method: 'DELETE', token: adminToken });
  ok('delete facilitator', r.status === 200);
  r = await call(`admin/students/${studentId}`, { method: 'DELETE', token: adminToken });
  ok('delete student', r.status === 200);

  r = await call('admin/messages', { token: adminToken });
  const smokeMsg = (r.data?.messages || []).find((m) => m.email === `smoke-${STAMP}@example.com`);
  let msgDeleted = !smokeMsg;
  if (smokeMsg) {
    const del = await call(`admin/messages/${smokeMsg.id}`, { method: 'DELETE', token: adminToken });
    msgDeleted = del.status === 200;
  }
  ok('delete smoke contact message', msgDeleted);

  console.log(`\n──────────────────────────────\n${passed} passed, ${failed} failed.\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Smoke test crashed:', e); process.exit(1); });
