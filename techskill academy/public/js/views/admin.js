/** Admin portal. */
import { api, updateUser } from '../api.js';
import {
  esc, qs, qsa, toast, openModal, confirmAction, avatar, hydrateFiles,
  fmtDate, fmtDateTime, field, input, select, textarea, val, readFileInfo,
  portalShell, bindPortal, emptyState, fmtBytes,
} from '../ui.js';

let ME = null;

export async function render({ tab = 'dashboard' }) {
  ME = (await api('/me')).user;
  const me = ME;

  const TITLES = {
    overview: ['Overview', 'Academy snapshot — students, staff, classes and messages.'],
    students: ['Students', 'Create, edit and manage student accounts.'],
    facilitators: ['Facilitators', 'Create, edit and manage facilitator accounts.'],
    classes: ['Classes', 'Create class batches, assign facilitators and manage enrollment.'],
    messages: ['Messages', 'Enquiries and messages from the website contact form.'],
    profile: ['My Profile', 'Your admin details, profile picture and password.'],
  };
  const [title, subtitle] = TITLES[tab] || TITLES.overview;

  const content = {
    overview: overviewTab, students: studentsTab, facilitators: facilitatorsTab,
    classes: classesTab, messages: messagesTab, profile: profileTab,
  }[tab] || overviewTab;

  const app = document.getElementById('app');
  app.innerHTML = portalShell({ role: 'admin', active: tab, title, subtitle, user: me, content: await content() });
  bindPortal();
  const binders = {
    overview: () => {}, students: bindStudents, facilitators: bindFacilitators,
    classes: bindClasses, messages: bindMessages, profile: bindProfile,
  };
  (binders[tab] || (() => {}))();
  await hydrateFiles(app);
}

// ---------- overview ----------

async function overviewTab() {
  const d = await api('/admin/overview');
  const c = d.counts;
  return `
  <div class="stat-cards">
    <div class="stat-card"><div class="n">${c.students}</div><div class="l">Students</div></div>
    <div class="stat-card"><div class="n">${c.facilitators}</div><div class="l">Facilitators</div></div>
    <div class="stat-card amber"><div class="n">${c.classes}</div><div class="l">Class Batches</div></div>
    <div class="stat-card ${c.unreadMessages ? 'red' : ''}"><div class="n">${c.unreadMessages}</div><div class="l">Unread Messages</div></div>
  </div>

  <div class="grid-2" style="align-items:start">
    <div class="panel">
      <div class="panel-head"><h3>Recent Messages</h3><a class="link-arrow" href="#/portal/admin/messages">All messages →</a></div>
      <div class="panel-body" style="padding-top:6px">
        ${d.recentMessages.length ? d.recentMessages.map((m) => `
        <div class="item-row">
          <div class="grow">
            <span class="t">${esc(m.subject)} ${m.read ? '' : '<span class="badge badge-red">New</span>'}</span>
            <span class="s">${esc(m.name)} · ${fmtDate(m.createdAt)}</span>
          </div>
        </div>`).join('') : emptyState('No messages', 'Contact-form enquiries will appear here.')}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Newest Students</h3><a class="link-arrow" href="#/portal/admin/students">All students →</a></div>
      <div class="panel-body" style="padding-top:6px">
        ${d.recentStudents.length ? d.recentStudents.map((s) => `
        <div class="item-row">
          ${avatar(s, 40)}
          <div class="grow"><span class="t">${esc(s.name)}</span><span class="s">${esc(s.matricNo || '')} · ${esc(s.email)}</span></div>
        </div>`).join('') : emptyState('No students yet', 'Add your first student from the Students tab.')}
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-body row">
      <a class="btn btn-primary" href="#/portal/admin/students">＋ Add Student</a>
      <a class="btn btn-dark" href="#/portal/admin/facilitators">＋ Add Facilitator</a>
      <a class="btn btn-outline" href="#/portal/admin/classes">＋ Add Class</a>
    </div>
  </div>`;
}

// ---------- students ----------

let studentsCache = [];

async function studentsTab() {
  const res = await api('/admin/students');
  studentsCache = res.students;
  return `
  <div class="toolbar">
    <div class="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input class="input" id="st-search" placeholder="Search by name, matric no, email or phone…">
    </div>
    <button class="btn btn-primary" id="st-add">＋ Add Student</button>
  </div>
  <div class="table-wrap">
    <table class="tbl">
      <thead><tr><th>Student</th><th>Matric No</th><th>Contact</th><th>Classes</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody id="st-body"></tbody>
    </table>
  </div>`;
}

function renderStudentRows(filter = '') {
  const f = filter.toLowerCase();
  const rows = studentsCache.filter((s) =>
    !f || [s.name, s.matricNo, s.email, s.phone].some((v) => String(v || '').toLowerCase().includes(f)));
  const body = qs('#st-body');
  body.innerHTML = rows.length ? rows.map((s) => `
    <tr>
      <td><div class="user-cell">${avatar(s, 38)}<div><strong>${esc(s.name)}</strong><span class="sub">${esc(s.gender || '')}${s.dob ? ' · ' + fmtDate(s.dob) : ''}</span></div></div></td>
      <td><span class="badge badge-navy">${esc(s.matricNo || '—')}</span></td>
      <td>${esc(s.email)}<span class="sub">${esc(s.phone || '')}</span></td>
      <td>${s.classCount}</td>
      <td>${fmtDate(s.createdAt)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-outline btn-sm" data-edit-st="${esc(s.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-pw-st="${esc(s.id)}">Reset Password</button>
          <button class="icon-btn danger" data-del-st="${esc(s.id)}" title="Delete student">🗑</button>
        </div>
      </td>
    </tr>`).join('') : '<tr><td colspan="6" class="center muted" style="padding:30px">No students match your search.</td></tr>';
  hydrateFiles(body);

  qsa('[data-edit-st]', body).forEach((b) => b.addEventListener('click', () => openStudentForm(studentsCache.find((s) => s.id === b.dataset.editSt))));
  qsa('[data-pw-st]', body).forEach((b) => b.addEventListener('click', () => openResetPassword('student', studentsCache.find((s) => s.id === b.dataset.pwSt))));
  qsa('[data-del-st]', body).forEach((b) => b.addEventListener('click', async () => {
    const s = studentsCache.find((x) => x.id === b.dataset.delSt);
    const ok = await confirmAction(`Permanently delete <b>${esc(s.name)}</b>? Their enrollments and submissions will also be removed.`, { okLabel: 'Delete student' });
    if (!ok) return;
    try {
      await api(`/admin/students/${s.id}`, { method: 'DELETE' });
      toast('Student deleted.');
      render({ tab: 'students' });
    } catch (e) { toast(e.message, 'error'); }
  }));
}

function openStudentForm(s = null) {
  const m = openModal({
    title: s ? `Edit Student — ${esc(s.name)}` : 'Add New Student',
    body: `
      <div class="form-grid">
        <div class="full">${field('Full Name *', input('sf-name', { value: s?.name || '', required: true }))}</div>
        ${field('Email Address *', input('sf-email', { type: 'email', value: s?.email || '', required: true }))}
        ${field('Phone Number', input('sf-phone', { value: s?.phone || '' }))}
        ${field('Date of Birth', input('sf-dob', { type: 'date', value: s?.dob || '' }))}
        ${field('Gender', select('sf-gender', ['', 'Male', 'Female'], s?.gender || ''))}
        <div class="full">${field('Home Address', input('sf-address', { value: s?.address || '' }))}</div>
        ${field('Guardian Name', input('sf-guardian', { value: s?.guardianName || '' }))}
        ${field('Guardian Phone', input('sf-guardian-phone', { value: s?.guardianPhone || '' }))}
        ${s ? '' : `<div class="full">${field('Initial Password', input('sf-password', { value: '', placeholder: 'Student@123' }), 'Default: Student@123 — the student can change it later.')}</div>`}
      </div>
      ${s ? `<p class="hint">Matric No: <b>${esc(s.matricNo)}</b></p>` : '<p class="hint">A matric number will be generated automatically.</p>'}`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
             <button class="btn btn-primary" id="sf-save">${s ? 'Save Changes' : 'Create Student'}</button>`,
  });

  qs('#sf-save', m.el).addEventListener('click', async () => {
    const btn = qs('#sf-save', m.el);
    try {
      btn.disabled = true; btn.textContent = 'Saving…';
      const payload = {
        name: val('sf-name', m.el), email: val('sf-email', m.el), phone: val('sf-phone', m.el),
        dob: val('sf-dob', m.el), gender: val('sf-gender', m.el), address: val('sf-address', m.el),
        guardianName: val('sf-guardian', m.el), guardianPhone: val('sf-guardian-phone', m.el),
      };
      if (s) {
        await api(`/admin/students/${s.id}`, { method: 'PUT', body: payload });
        toast('Student updated.');
      } else {
        payload.password = val('sf-password', m.el) || undefined;
        const res = await api('/admin/students', { method: 'POST', body: payload });
        toast(res.message || 'Student created.');
      }
      m.close();
      render({ tab: 'students' });
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = s ? 'Save Changes' : 'Create Student';
    }
  });
}

function openResetPassword(kind, user) {
  const m = openModal({
    title: `Reset Password — ${esc(user.name)}`,
    body: `${field('New Password *', input('rp-new', { placeholder: 'At least 6 characters' }))}
           <p class="hint">Share the new password with ${esc((user.name || '').split(' ')[0])} privately. They can change it after signing in.</p>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="rp-save">Reset Password</button>`,
  });
  qs('#rp-save', m.el).addEventListener('click', async () => {
    try {
      await api(`/admin/${kind}s/${user.id}/reset-password`, { method: 'POST', body: { newPassword: val('rp-new', m.el) } });
      toast('Password has been reset.');
      m.close();
    } catch (e) { toast(e.message, 'error'); }
  });
}

function bindStudents() {
  qs('#st-search').addEventListener('input', (e) => renderStudentRows(e.target.value));
  qs('#st-add').addEventListener('click', () => openStudentForm());
  renderStudentRows();
}

// ---------- facilitators ----------

let facilitatorsCache = [];

async function facilitatorsTab() {
  const res = await api('/admin/facilitators');
  facilitatorsCache = res.facilitators;
  return `
  <div class="toolbar">
    <div class="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input class="input" id="fa-search" placeholder="Search facilitators…">
    </div>
    <button class="btn btn-primary" id="fa-add">＋ Add Facilitator</button>
  </div>
  <div class="table-wrap">
    <table class="tbl">
      <thead><tr><th>Facilitator</th><th>Contact</th><th>Expertise</th><th>Classes</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody id="fa-body"></tbody>
    </table>
  </div>`;
}

function renderFacilitatorRows(filter = '') {
  const f = filter.toLowerCase();
  const rows = facilitatorsCache.filter((x) => !f || [x.name, x.email, x.expertise, x.phone].some((v) => String(v || '').toLowerCase().includes(f)));
  const body = qs('#fa-body');
  body.innerHTML = rows.length ? rows.map((x) => `
    <tr>
      <td><div class="user-cell">${avatar(x, 38)}<div><strong>${esc(x.name)}</strong><span class="sub">${esc(x.email)}</span></div></div></td>
      <td>${esc(x.phone || '—')}</td>
      <td>${esc(x.expertise || '—')}</td>
      <td>${x.classCount}</td>
      <td>${fmtDate(x.createdAt)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-outline btn-sm" data-edit-fa="${esc(x.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-pw-fa="${esc(x.id)}">Reset Password</button>
          <button class="icon-btn danger" data-del-fa="${esc(x.id)}" title="Delete facilitator">🗑</button>
        </div>
      </td>
    </tr>`).join('') : '<tr><td colspan="6" class="center muted" style="padding:30px">No facilitators match your search.</td></tr>';
  hydrateFiles(body);

  qsa('[data-edit-fa]', body).forEach((b) => b.addEventListener('click', () => openFacilitatorForm(facilitatorsCache.find((x) => x.id === b.dataset.editFa))));
  qsa('[data-pw-fa]', body).forEach((b) => b.addEventListener('click', () => openResetPassword('facilitator', facilitatorsCache.find((x) => x.id === b.dataset.pwFa))));
  qsa('[data-del-fa]', body).forEach((b) => b.addEventListener('click', async () => {
    const x = facilitatorsCache.find((y) => y.id === b.dataset.delFa);
    const ok = await confirmAction(`Permanently delete <b>${esc(x.name)}</b>? Their classes will be left without a facilitator.`, { okLabel: 'Delete facilitator' });
    if (!ok) return;
    try {
      await api(`/admin/facilitators/${x.id}`, { method: 'DELETE' });
      toast('Facilitator deleted.');
      render({ tab: 'facilitators' });
    } catch (e) { toast(e.message, 'error'); }
  }));
}

function openFacilitatorForm(f = null) {
  const m = openModal({
    title: f ? `Edit Facilitator — ${esc(f.name)}` : 'Add New Facilitator',
    body: `
      <div class="form-grid">
        <div class="full">${field('Full Name *', input('ff-name', { value: f?.name || '', required: true }))}</div>
        ${field('Email Address *', input('ff-email', { type: 'email', value: f?.email || '', required: true }))}
        ${field('Phone Number', input('ff-phone', { value: f?.phone || '' }))}
        <div class="full">${field('Area of Expertise', input('ff-expertise', { value: f?.expertise || '', placeholder: 'e.g. Networking & System Security' }))}</div>
        <div class="full">${field('Short Bio', textarea('ff-bio', f?.bio || '', 3))}</div>
        ${f ? '' : `<div class="full">${field('Initial Password', input('ff-password', { placeholder: 'Facilitator@123' }), 'Default: Facilitator@123 — they can change it later.')}</div>`}
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
             <button class="btn btn-primary" id="ff-save">${f ? 'Save Changes' : 'Create Facilitator'}</button>`,
  });
  qs('#ff-save', m.el).addEventListener('click', async () => {
    const btn = qs('#ff-save', m.el);
    try {
      btn.disabled = true; btn.textContent = 'Saving…';
      const payload = {
        name: val('ff-name', m.el), email: val('ff-email', m.el), phone: val('ff-phone', m.el),
        expertise: val('ff-expertise', m.el), bio: val('ff-bio', m.el),
      };
      if (f) {
        await api(`/admin/facilitators/${f.id}`, { method: 'PUT', body: payload });
        toast('Facilitator updated.');
      } else {
        payload.password = val('ff-password', m.el) || undefined;
        const res = await api('/admin/facilitators', { method: 'POST', body: payload });
        toast(res.message || 'Facilitator created.');
      }
      m.close();
      render({ tab: 'facilitators' });
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = f ? 'Save Changes' : 'Create Facilitator';
    }
  });
}

function bindFacilitators() {
  qs('#fa-search').addEventListener('input', (e) => renderFacilitatorRows(e.target.value));
  qs('#fa-add').addEventListener('click', () => openFacilitatorForm());
  renderFacilitatorRows();
}

// ---------- classes ----------

let coursesCache = [];
let classesCache = [];
let allStudentsCache = [];

async function classesTab() {
  const [coursesRes, classesRes, studentsRes, facilitatorsRes] = await Promise.all([
    api('/public/courses'),
    api('/admin/classes'),
    api('/admin/students'),
    api('/admin/facilitators'),
  ]);
  coursesCache = coursesRes.courses;
  classesCache = classesRes.classes;
  allStudentsCache = studentsRes.students;
  facilitatorsCache = facilitatorsRes.facilitators;

  return `
  <div class="toolbar">
    <span class="muted small">${classesCache.length} class batch${classesCache.length === 1 ? '' : 'es'} total</span>
    <button class="btn btn-primary" id="cl-add" style="margin-left:auto">＋ Add Class</button>
  </div>
  <div class="table-wrap">
    <table class="tbl">
      <thead><tr><th>Class</th><th>Course / Level</th><th>Facilitator</th><th>Schedule</th><th>Dates</th><th>Students</th><th>Actions</th></tr></thead>
      <tbody id="cl-body"></tbody>
    </table>
  </div>`;
}

function renderClassRows() {
  const body = qs('#cl-body');
  body.innerHTML = classesCache.length ? classesCache.map((c) => `
    <tr>
      <td><strong>${esc(c.title)}</strong></td>
      <td>${esc(c.courseTitle)}<span class="sub">${esc(c.level)}</span></td>
      <td>${c.facilitator ? esc(c.facilitator.name) : '<span class="badge badge-gray">Unassigned</span>'}</td>
      <td>${esc(c.schedule || '—')}</td>
      <td>${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}</td>
      <td><span class="badge badge-blue">${c.enrolledCount}</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-outline btn-sm" data-edit-cl="${esc(c.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-enroll-cl="${esc(c.id)}">Enrollment</button>
          <button class="icon-btn danger" data-del-cl="${esc(c.id)}" title="Delete class">🗑</button>
        </div>
      </td>
    </tr>`).join('') : '<tr><td colspan="7" class="center muted" style="padding:30px">No classes yet — create your first batch.</td></tr>';

  qsa('[data-edit-cl]', body).forEach((b) => b.addEventListener('click', () => openClassForm(classesCache.find((c) => c.id === b.dataset.editCl))));
  qsa('[data-enroll-cl]', body).forEach((b) => b.addEventListener('click', () => openEnrollmentModal(classesCache.find((c) => c.id === b.dataset.enrollCl))));
  qsa('[data-del-cl]', body).forEach((b) => b.addEventListener('click', async () => {
    const c = classesCache.find((x) => x.id === b.dataset.delCl);
    const ok = await confirmAction(`Delete <b>${esc(c.title)}</b>? All its materials, assessments and grades will be permanently removed.`, { okLabel: 'Delete class' });
    if (!ok) return;
    try {
      await api(`/admin/classes/${c.id}`, { method: 'DELETE' });
      toast('Class deleted.');
      render({ tab: 'classes' });
    } catch (e) { toast(e.message, 'error'); }
  }));
}

function openClassForm(c = null) {
  const m = openModal({
    title: c ? `Edit Class — ${esc(c.title)}` : 'Add New Class',
    body: `
      <div class="form-grid">
        <div class="full">${field('Course *', select('cf-course', coursesCache.map((x) => ({ value: x.id, label: x.title })), c?.courseId || '', { placeholder: 'Select course…' }))}</div>
        ${field('Level *', select('cf-level', ['Beginner', 'Intermediate', 'Advanced'], c?.level || 'Beginner'))}
        ${field('Batch Title *', input('cf-title', { value: c?.title || '', placeholder: 'e.g. CCTV Installation — Weekend Batch' }))}
        <div class="full">${field('Facilitator', select('cf-fac', [{ value: '', label: '— Unassigned —' }, ...facilitatorsCache.map((f) => ({ value: f.id, label: f.name }))], c?.facilitatorId || ''))}</div>
        <div class="full">${field('Schedule', input('cf-schedule', { value: c?.schedule || '', placeholder: 'e.g. Mon & Wed · 10:00 AM – 1:00 PM' }))}</div>
        ${field('Start Date', input('cf-start', { type: 'date', value: c?.startDate || '' }))}
        ${field('End Date', input('cf-end', { type: 'date', value: c?.endDate || '' }))}
        <div class="full">${field('Description', input('cf-desc', { value: c?.description || '' }))}</div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
             <button class="btn btn-primary" id="cf-save">${c ? 'Save Changes' : 'Create Class'}</button>`,
  });
  qs('#cf-save', m.el).addEventListener('click', async () => {
    const btn = qs('#cf-save', m.el);
    try {
      btn.disabled = true; btn.textContent = 'Saving…';
      const payload = {
        courseId: val('cf-course', m.el), level: val('cf-level', m.el), title: val('cf-title', m.el),
        facilitatorId: val('cf-fac', m.el) || null, schedule: val('cf-schedule', m.el),
        startDate: val('cf-start', m.el) || null, endDate: val('cf-end', m.el) || null,
        description: val('cf-desc', m.el),
      };
      if (c) {
        await api(`/admin/classes/${c.id}`, { method: 'PUT', body: payload });
        toast('Class updated.');
      } else {
        await api('/admin/classes', { method: 'POST', body: payload });
        toast('Class created.');
      }
      m.close();
      render({ tab: 'classes' });
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = c ? 'Save Changes' : 'Create Class';
    }
  });
}

function openEnrollmentModal(c) {
  const m = openModal({
    title: `Enrollment — ${esc(c.title)}`,
    wide: true,
    body: `
      <div class="mb-2">
        <div class="row">
          ${select('en-student', allStudentsCache.map((s) => ({ value: s.id, label: `${s.name} (${s.matricNo})` })), '', { placeholder: 'Choose a student to enroll…' })}
          <button class="btn btn-primary btn-sm" id="en-add">Enroll</button>
        </div>
      </div>
      <div id="en-list"></div>`,
    footer: '<button class="btn btn-dark" data-close>Done</button>',
  });

  const renderList = () => {
    const fresh = classesCache.find((x) => x.id === c.id) || c;
    qs('#en-list', m.el).innerHTML = fresh.students && fresh.students.length ? fresh.students.map((s) => `
      <div class="item-row">
        ${avatar(s, 36)}
        <div class="grow"><span class="t">${esc(s.name)}</span><span class="s">${esc(s.matricNo || '')} · ${esc(s.email || '')}</span></div>
        <button class="icon-btn danger" data-unenroll="${esc(s.id)}" title="Remove from class">✕</button>
      </div>`).join('') : '<p class="muted small" style="padding:14px 0">No students enrolled in this batch yet.</p>';
    hydrateFiles(qs('#en-list', m.el));
    qsa('[data-unenroll]', m.el).forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          await api(`/admin/unenroll/${c.id}/${b.dataset.unenroll}`, { method: 'DELETE' });
          toast('Student removed from class.');
          const idx = fresh.students.findIndex((s) => s.id === b.dataset.unenroll);
          if (idx > -1) fresh.students.splice(idx, 1);
          fresh.enrolledCount = fresh.students.length;
          renderList();
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  };
  renderList();

  qs('#en-add', m.el).addEventListener('click', async () => {
    const studentId = qs('#en-student', m.el).value;
    if (!studentId) return toast('Choose a student first.', 'error');
    try {
      const res = await api('/admin/enroll', { method: 'POST', body: { studentId, classId: c.id } });
      toast(res.message || 'Enrolled.');
      const student = allStudentsCache.find((s) => s.id === studentId);
      if (student && !fresh2(fresh, student)) fresh.students.push({ id: student.id, name: student.name, matricNo: student.matricNo, email: student.email, photoKey: student.photoKey });
      fresh.enrolledCount = fresh.students.length;
      renderList();
    } catch (e) { toast(e.message, 'error'); }
  });

  function fresh2(f, s) { return f.students.some((x) => x.id === s.id); }
}

function bindClasses() {
  qs('#cl-add').addEventListener('click', () => openClassForm());
  renderClassRows();
}

// ---------- messages ----------

let messagesCache = [];

async function messagesTab() {
  const res = await api('/admin/messages');
  messagesCache = res.messages;
  return `
  <div id="ms-list">
    ${messagesCache.length ? messagesCache.map((msg) => `
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="row" style="gap:8px"><h3 style="font-size:1rem">${esc(msg.subject)}</h3>${msg.read ? '' : '<span class="badge badge-red">New</span>'}</div>
          <div class="small muted">${esc(msg.name)} · ${esc(msg.email)}${msg.phone ? ' · ' + esc(msg.phone) : ''} · ${fmtDateTime(msg.createdAt)}</div>
        </div>
        <div class="actions">
          ${msg.read ? '' : `<button class="btn btn-outline btn-sm" data-read-msg="${esc(msg.id)}">Mark as read</button>`}
          <button class="icon-btn danger" data-del-msg="${esc(msg.id)}" title="Delete message">🗑</button>
        </div>
      </div>
      <div class="panel-body"><p style="white-space:pre-wrap">${esc(msg.message)}</p></div>
    </div>`).join('') : emptyState('No messages', 'Enquiries from the website contact form will appear here.')}
  </div>`;
}

function bindMessages() {
  qsa('[data-read-msg]').forEach((b) => {
    b.addEventListener('click', async () => {
      try {
        await api(`/admin/messages/${b.dataset.readMsg}`, { method: 'PUT', body: { read: true } });
        render({ tab: 'messages' });
      } catch (e) { toast(e.message, 'error'); }
    });
  });
  qsa('[data-del-msg]').forEach((b) => {
    b.addEventListener('click', async () => {
      const ok = await confirmAction('Delete this message permanently?', { okLabel: 'Delete' });
      if (!ok) return;
      try {
        await api(`/admin/messages/${b.dataset.delMsg}`, { method: 'DELETE' });
        toast('Message deleted.');
        render({ tab: 'messages' });
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ---------- profile ----------

function profileTab() {
  const me = ME;
  return `
  <div class="grid-2" style="align-items:start">
    <div class="panel">
      <div class="panel-head"><h3>Profile Picture</h3></div>
      <div class="panel-body">
        <div class="passport-box">
          ${avatar(me, 96)}
          <div>
            <label class="file-drop" id="aprofile-drop" style="min-width:230px">📷 Click to upload a photo (JPG/PNG, max 4 MB)<input type="file" id="aprofile-file" accept="image/*"></label>
            <p class="hint mt-1">Shown next to your name around the portal.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>My Details</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          <div class="full">${field('Full Name *', input('apf-name', { value: me.name, required: true }))}</div>
          ${field('Phone Number', input('apf-phone', { value: me.phone || '' }))}
          ${field('Email Address', input('apf-email', { value: me.email, attrs: 'disabled' }))}
        </div>
        <div class="row spread mt-2">
          <span class="small muted">Administrator account</span>
          <button class="btn btn-primary" id="apf-save">Save Changes</button>
        </div>
      </div>
    </div>
  </div>

  <div class="panel" style="max-width:520px">
    <div class="panel-head"><h3>Change Password</h3></div>
    <div class="panel-body">
      ${field('Current Password', input('acp-current', { type: 'password' }))}
      ${field('New Password', input('acp-new', { type: 'password' }), 'At least 6 characters — use a strong, unique password.')}
      ${field('Confirm New Password', input('acp-confirm', { type: 'password' }))}
      <button class="btn btn-dark" id="acp-save">Update Password</button>
    </div>
  </div>`;
}

function bindProfile() {
  const drop = qs('#aprofile-drop');
  qs('#aprofile-file').addEventListener('change', async () => {
    try {
      const file = await readFileInfo(qs('#aprofile-file'));
      if (!file) return;
      drop.innerHTML = '⏳ Uploading…';
      const res = await api('/me/photo', { method: 'POST', body: { file } });
      updateUser(res.user);
      ME = res.user;
      toast('Profile picture updated!');
      render({ tab: 'profile' });
    } catch (e) {
      toast(e.message, 'error');
      drop.innerHTML = '📷 Click to upload a photo (JPG/PNG, max 4 MB)<input type="file" id="aprofile-file" accept="image/*">';
    }
  });

  qs('#apf-save').addEventListener('click', async () => {
    try {
      const res = await api('/me', { method: 'PUT', body: { name: val('apf-name'), phone: val('apf-phone') } });
      updateUser(res.user);
      ME = res.user;
      toast('Profile updated!');
      render({ tab: 'profile' });
    } catch (e) { toast(e.message, 'error'); }
  });

  qs('#acp-save').addEventListener('click', async () => {
    if (val('acp-new') !== val('acp-confirm')) return toast('New passwords do not match.', 'error');
    if (val('acp-new').length < 6) return toast('New password must be at least 6 characters.', 'error');
    try {
      const res = await api('/me/password', { method: 'PUT', body: { currentPassword: val('acp-current'), newPassword: val('acp-new') } });
      toast(res.message || 'Password updated!');
      ['acp-current', 'acp-new', 'acp-confirm'].forEach((id) => { qs('#' + id).value = ''; });
    } catch (e) { toast(e.message, 'error'); }
  });
}
