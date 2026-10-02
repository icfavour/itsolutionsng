/** Facilitator portal. */
import { api, auth, updateUser, downloadFile } from '../api.js';
import {
  esc, qs, qsa, toast, openModal, confirmAction, avatar, hydrateFiles,
  fmtDate, fmtDateTime, fmtBytes, pct, gradeBadge,
  field, input, select, textarea, val, readFileInfo, fileExt,
  portalShell, bindPortal, emptyState,
} from '../ui.js';

let DATA = null;

export async function render({ tab = 'dashboard' }) {
  DATA = await api('/facilitator/overview');
  const me = DATA.facilitator;
  const first = (me.name || '').split(' ')[0];

  const TITLES = {
    dashboard: ['Dashboard', `Welcome, ${first}! Here\u2019s what\u2019s happening in your classes.`],
    classes: ['My Classes', 'Batches assigned to you and the students in them.'],
    materials: ['Course Materials', 'Upload topic materials for your students to download.'],
    assessments: ['Assessments', 'Create and manage quizzes, assignments, projects and exams.'],
    grading: ['Grading', 'Review submissions and record scores with feedback.'],
    students: ['My Students', 'Students enrolled in your classes, with their grades.'],
    profile: ['My Profile', 'Your details, profile picture and password.'],
  };
  const [title, subtitle] = TITLES[tab] || TITLES.dashboard;

  const content = {
    dashboard: dashboardTab, classes: classesTab, materials: materialsTab,
    assessments: assessmentsTab, grading: gradingTab, students: studentsTab, profile: profileTab,
  }[tab] || dashboardTab;

  const app = document.getElementById('app');
  app.innerHTML = portalShell({ role: 'facilitator', active: tab, title, subtitle, user: me, content: content() });
  bindPortal();
  bindDl();
  const binders = {
    dashboard: bindDashboard, classes: bindClasses, materials: bindMaterials,
    assessments: bindAssessments, grading: bindGrading, students: bindStudents, profile: bindProfile,
  };
  (binders[tab] || bindDashboard)();
  await hydrateFiles(app);
}

function bindDl() {
  qsa('[data-dl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await downloadFile(btn.dataset.dl, btn.dataset.name); }
      catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ---------- dashboard ----------

function dashboardTab() {
  const s = DATA.stats;
  return `
  <div class="stat-cards">
    <div class="stat-card"><div class="n">${s.classes}</div><div class="l">My Classes</div></div>
    <div class="stat-card"><div class="n">${s.students}</div><div class="l">My Students</div></div>
    <div class="stat-card amber"><div class="n">${s.awaitingGrading}</div><div class="l">Awaiting Grading</div></div>
    <div class="stat-card green"><div class="n">${s.graded}</div><div class="l">Graded Submissions</div></div>
  </div>

  <div class="panel">
    <div class="panel-head"><h3>Recent Submissions</h3><a class="link-arrow" href="#/portal/facilitator/grading">Go to grading →</a></div>
    <div class="panel-body" style="padding-top:6px">
      ${DATA.recentSubmissions.length ? DATA.recentSubmissions.map((s) => `
      <div class="item-row">
        ${avatar(s, 40)}
        <div class="grow"><span class="t">${esc(s.studentName)} — ${esc(s.assessmentTitle)}</span><span class="s">${esc(s.matricNo || '')} · Submitted ${fmtDateTime(s.submittedAt)}${s.late ? ' · <b style="color:var(--red)">Late</b>' : ''}</span></div>
        ${s.score != null ? gradeBadge(pct(s.score, s.maxScore)) : '<span class="badge badge-amber">Needs grading</span>'}
      </div>`).join('') : emptyState('No submissions yet', 'Submissions from your students will appear here.')}
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><h3>My Classes</h3></div>
    <div class="panel-body" style="padding-top:6px">
      ${DATA.classes.length ? DATA.classes.map((c) => `
      <div class="item-row">
        <div class="grow"><span class="t">${esc(c.title)}</span><span class="s">${esc(c.courseTitle)} · ${esc(c.level)} · ${esc(c.schedule || 'TBA')}</span></div>
        <span class="badge badge-blue">${c.enrolledCount} students</span>
      </div>`).join('') : emptyState('No classes assigned', 'The administrator will assign class batches to you.')}
    </div>
  </div>`;
}

function bindDashboard() { /* nothing extra */ }

// ---------- classes ----------

function classesTab() {
  if (!DATA.classes.length) return emptyState('No classes assigned yet', 'Class batches assigned to you by the administrator will appear here.');
  return DATA.classes.map((c) => `
  <div class="panel">
    <div class="panel-head">
      <div>
        <div class="row" style="gap:8px"><span class="badge badge-blue">${esc(c.courseCode)} · ${esc(c.level)}</span><span class="badge badge-gray">${c.enrolledCount} student${c.enrolledCount === 1 ? '' : 's'}</span></div>
        <h3 class="mt-1">${esc(c.title)}</h3>
        <div class="small muted">🗓 ${esc(c.schedule || 'TBA')} · 📆 ${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}</div>
      </div>
    </div>
    <div class="panel-body" style="padding-top:8px">
      ${c.enrolledCount
        ? `<div id="class-students-${esc(c.id)}" style="display:none"></div>
           <button class="btn btn-outline btn-sm" data-load-students="${esc(c.id)}">Show enrolled students</button>`
        : '<p class="muted small">No students enrolled in this batch yet.</p>'}
    </div>
  </div>`).join('');
}

async function bindClasses() {
  qsa('[data-load-students]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const holder = qs(`#class-students-${btn.dataset.loadStudents}`);
      if (holder.style.display === 'none') {
        holder.style.display = '';
        btn.textContent = 'Hide enrolled students';
        if (!holder.innerHTML.trim()) {
          try {
            const res = await api('/facilitator/students');
            const classId = btn.dataset.loadStudents;
            const inThisClass = res.students.filter((s) => s.myClasses.some((c) => c.id === classId));
            holder.innerHTML = inThisClass.length ? inThisClass.map((s) => `
              <div class="item-row">
                ${avatar(s, 40)}
                <div class="grow"><span class="t">${esc(s.name)}</span><span class="s">${esc(s.matricNo || '')} · ${esc(s.email)}</span></div>
              </div>`).join('') : '<p class="muted small">Nobody yet.</p>';
            await hydrateFiles(holder);
          } catch (e) { toast(e.message, 'error'); }
        }
      } else {
        holder.style.display = 'none';
        btn.textContent = 'Show enrolled students';
      }
    });
  });
}

// ---------- materials ----------

function materialsTab() {
  if (!DATA.classes.length) return emptyState('No classes assigned yet', 'You need an assigned class before you can upload materials.');
  const materials = DATA.classes.flatMap((c) => (c.materials || []).map((m) => ({ ...m, classTitle: c.title })))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return `
  <div class="panel">
    <div class="panel-head"><h3>📤 Upload a Topic Material</h3></div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="full">${field('Class *', select('mat-class', DATA.classes.map((c) => ({ value: c.id, label: c.title })), '', { placeholder: 'Select class…' }))}</div>
        <div class="full">${field('Topic / Title *', input('mat-title', { placeholder: 'e.g. Week 3 — IP Addressing & Subnetting' }))}</div>
        <div class="full">${field('Short description', input('mat-desc', { placeholder: 'What this material covers (optional)' }))}</div>
        <div class="full">
          <div class="field"><label>File * (PDF, DOCX, PPT, images… max 4 MB)</label>
          <label class="file-drop" id="mat-drop">📄 Click to choose a file<input type="file" id="mat-file"></label></div>
        </div>
      </div>
      <button class="btn btn-primary" id="mat-upload">Upload Material</button>
    </div>
  </div>

  <div class="table-wrap">
    <table class="tbl">
      <thead><tr><th>Class</th><th>Topic</th><th>File</th><th>Size</th><th>Uploaded</th><th></th></tr></thead>
      <tbody>
        ${materials.length ? materials.map((m) => `
        <tr>
          <td>${esc(m.classTitle)}</td>
          <td><strong>${esc(m.title)}</strong>${m.description ? `<span class="small muted" style="display:block">${esc(m.description)}</span>` : ''}</td>
          <td><button class="btn btn-ghost btn-sm" data-dl="${esc(m.fileKey)}" data-name="${esc(m.fileName)}">📎 ${esc(m.fileName)}</button></td>
          <td>${fmtBytes(m.size)}</td>
          <td>${fmtDate(m.uploadedAt)}</td>
          <td><button class="icon-btn danger" data-del-mat="${esc(m.id)}" title="Delete material">🗑</button></td>
        </tr>`).join('') : '<tr><td colspan="6" class="center muted" style="padding:30px">No materials uploaded yet.</td></tr>'}
      </tbody>
    </table>
  </div>`;
}

function bindMaterials() {
  const drop = qs('#mat-drop');
  qs('#mat-file').addEventListener('change', () => {
    const f = qs('#mat-file').files[0];
    if (f) { drop.classList.add('has-file'); drop.innerHTML = `✅ ${esc(f.name)} (${fmtBytes(f.size)})<input type="file" id="mat-file">`; }
  });

  qs('#mat-upload').addEventListener('click', async () => {
    const btn = qs('#mat-upload');
    try {
      const file = await readFileInfo(qs('#mat-file'));
      if (!val('mat-class')) return toast('Please select a class.', 'error');
      if (!val('mat-title')) return toast('Please enter the topic/title.', 'error');
      if (!file) return toast('Please choose a file to upload.', 'error');
      btn.disabled = true; btn.textContent = 'Uploading…';
      await api('/facilitator/materials', {
        method: 'POST',
        body: { classId: val('mat-class'), title: val('mat-title'), description: val('mat-desc'), file },
      });
      toast('Material uploaded — your students can now download it.');
      render({ tab: 'materials' });
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = 'Upload Material';
    }
  });

  qsa('[data-del-mat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction('Delete this material? Students will no longer be able to download it.', { okLabel: 'Delete' });
      if (!ok) return;
      try {
        await api(`/facilitator/materials/${btn.dataset.delMat}`, { method: 'DELETE' });
        toast('Material deleted.');
        render({ tab: 'materials' });
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ---------- assessments ----------

function assessmentsTab() {
  if (!DATA.classes.length) return emptyState('No classes assigned yet', 'You need an assigned class before you can create assessments.');
  const assessments = DATA.classes.flatMap((c) => (c.assessments || []).map((a) => ({ ...a, classTitle: c.title })));
  const TYPES = ['Quiz', 'Assignment', 'Project', 'Exam'];

  return `
  <div class="panel">
    <div class="panel-head"><h3>➕ Create Assessment</h3></div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="full">${field('Class *', select('as-class', DATA.classes.map((c) => ({ value: c.id, label: c.title })), '', { placeholder: 'Select class…' }))}</div>
        <div class="full">${field('Title *', input('as-title', { placeholder: 'e.g. Quiz 2 — Network Devices' }))}</div>
        ${field('Type *', select('as-type', TYPES, 'Quiz'))}
        ${field('Maximum Score *', input('as-max', { type: 'number', value: '20', attrs: 'min="1" max="1000"' }))}
        <div class="full">${field('Due Date', input('as-due', { type: 'date' }), 'Optional — students can still submit after (marked late).')}</div>
      </div>
      <button class="btn btn-primary" id="as-create">Create Assessment</button>
    </div>
  </div>

  <div class="table-wrap">
    <table class="tbl">
      <thead><tr><th>Class</th><th>Assessment</th><th>Type</th><th>Max Score</th><th>Due Date</th><th></th></tr></thead>
      <tbody>
        ${assessments.length ? assessments.map((a) => `
        <tr>
          <td>${esc(a.classTitle)}</td>
          <td><strong>${esc(a.title)}</strong></td>
          <td><span class="badge badge-blue">${esc(a.type)}</span></td>
          <td>${a.maxScore}</td>
          <td>${a.dueDate ? fmtDate(a.dueDate) : '—'}</td>
          <td><button class="icon-btn danger" data-del-as="${esc(a.id)}" title="Delete assessment and its submissions">🗑</button></td>
        </tr>`).join('') : '<tr><td colspan="6" class="center muted" style="padding:30px">No assessments created yet.</td></tr>'}
      </tbody>
    </table>
  </div>`;
}

function bindAssessments() {
  qs('#as-create').addEventListener('click', async () => {
    const btn = qs('#as-create');
    try {
      if (!val('as-class')) return toast('Please select a class.', 'error');
      if (!val('as-title')) return toast('Please enter a title.', 'error');
      btn.disabled = true; btn.textContent = 'Creating…';
      await api('/facilitator/assessments', {
        method: 'POST',
        body: {
          classId: val('as-class'), title: val('as-title'), type: val('as-type'),
          maxScore: Number(val('as-max') || 0), dueDate: val('as-due') || null,
        },
      });
      toast('Assessment created — it is now visible to enrolled students.');
      render({ tab: 'assessments' });
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = 'Create Assessment';
    }
  });

  qsa('[data-del-as]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction('Delete this assessment? All student submissions and grades for it will also be deleted.', { okLabel: 'Delete' });
      if (!ok) return;
      try {
        await api(`/facilitator/assessments/${btn.dataset.delAs}`, { method: 'DELETE' });
        toast('Assessment deleted.');
        render({ tab: 'assessments' });
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ---------- grading ----------

let gradingFilter = 'pending';

function gradingTab() {
  return `
  <div class="toolbar">
    <div class="pills">
      <button class="pill ${gradingFilter === 'pending' ? 'active' : ''}" data-gfilter="pending">Awaiting grading</button>
      <button class="pill ${gradingFilter === 'graded' ? 'active' : ''}" data-gfilter="graded">Graded</button>
      <button class="pill ${gradingFilter === 'all' ? 'active' : ''}" data-gfilter="all">All</button>
    </div>
    <button class="btn btn-primary btn-sm" id="grading-refresh">↻ Refresh</button>
  </div>
  <div id="grading-list" class="panel card-flat"><div class="panel-body center muted">Loading submissions…</div></div>`;
}

async function loadGradingList() {
  const listEl = qs('#grading-list');
  try {
    const res = await api(`/facilitator/submissions?status=${gradingFilter}`);
    if (!res.submissions.length) {
      listEl.innerHTML = `<div class="panel-body">${emptyState('Nothing here', gradingFilter === 'pending' ? 'All submissions have been graded. Great job!' : 'No submissions to show.')}</div>`;
      return;
    }
    listEl.innerHTML = `<div class="panel-body" style="padding-top:6px">
      ${res.submissions.map((s) => `
      <div class="item-row">
        ${avatar({ name: s.studentName, photoKey: s.photoKey }, 42)}
        <div class="grow">
          <span class="t">${esc(s.studentName)} — ${esc(s.assessmentTitle)}</span>
          <span class="s">${esc(s.matricNo || '')} · ${esc(s.classTitle)} · ${esc(s.assessmentType)} (max ${s.maxScore}) · ${fmtDateTime(s.submittedAt)}${s.late ? ' · <b style="color:var(--red)">Late</b>' : ''}</span>
        </div>
        ${s.score != null ? gradeBadge(pct(s.score, s.maxScore)) : '<span class="badge badge-amber">Needs grading</span>'}
        <button class="btn ${s.score != null ? 'btn-ghost' : 'btn-primary'} btn-sm" data-grade="${esc(s.id)}">${s.score != null ? 'Edit grade' : 'Grade'}</button>
      </div>`).join('')}
    </div>`;
    await hydrateFiles(listEl);

    qsa('[data-grade]', listEl).forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = res.submissions.find((x) => x.id === btn.dataset.grade);
        if (s) openGradeModal(s);
      });
    });
  } catch (e) {
    listEl.innerHTML = `<div class="panel-body"><div class="form-error">${esc(e.message)}</div></div>`;
  }
}

function openGradeModal(s) {
  const m = openModal({
    title: `Grade — ${esc(s.assessmentTitle)}`,
    body: `
      <div class="user-cell mb-2">${avatar({ name: s.studentName, photoKey: s.photoKey }, 46)}
        <div><strong>${esc(s.studentName)}</strong><span class="small muted" style="display:block">${esc(s.matricNo || '')} · ${esc(s.classTitle)}</span></div>
      </div>
      ${s.content ? `<div class="field"><label>Student\u2019s answer</label><div class="card card-flat small" style="white-space:pre-wrap">${esc(s.content)}</div></div>` : '<p class="muted small">No written answer.</p>'}
      ${s.fileKey ? `<div class="mb-2"><button class="btn btn-outline btn-sm" id="gm-download">📎 ${esc(s.fileName || 'Download attachment')}</button></div>` : ''}
      <p class="hint mb-2">Submitted ${fmtDateTime(s.submittedAt)}${s.late ? ' · <b style="color:var(--red)">Late</b>' : ''}</p>
      <div class="form-grid">
        ${field(`Score (0 – ${s.maxScore}) *`, input('gm-score', { type: 'number', value: s.score ?? '', attrs: `min="0" max="${s.maxScore}" step="0.5"` }))}
        <div class="full">${field('Feedback', textarea('gm-feedback', s.feedback || '', 3), 'Shown to the student with their score.')}</div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="gm-save">Save Grade</button>`,
  });

  const dl = qs('#gm-download', m.el);
  if (dl) dl.addEventListener('click', async () => {
    try { await downloadFile(s.fileKey, s.fileName); } catch (e) { toast(e.message, 'error'); }
  });

  qs('#gm-save', m.el).addEventListener('click', async () => {
    const btn = qs('#gm-save', m.el);
    try {
      btn.disabled = true; btn.textContent = 'Saving…';
      await api('/facilitator/grade', {
        method: 'POST',
        body: { submissionId: s.id, score: Number(val('gm-score', m.el)), feedback: val('gm-feedback', m.el) },
      });
      m.close();
      toast('Grade saved.');
      loadGradingList();
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = 'Save Grade';
    }
  });
}

function bindGrading() {
  qsa('[data-gfilter]').forEach((pill) => {
    pill.addEventListener('click', () => {
      gradingFilter = pill.dataset.gfilter;
      qsa('[data-gfilter]').forEach((p) => p.classList.toggle('active', p === pill));
      loadGradingList();
    });
  });
  qs('#grading-refresh').addEventListener('click', loadGradingList);
  loadGradingList();
}

// ---------- students ----------

function studentsTab() {
  return `
  <div class="toolbar"><span class="muted small">Students enrolled across your classes. Click a student to view details and grades.</span></div>
  <div id="fac-students" class="panel card-flat"><div class="panel-body center muted">Loading students…</div></div>`;
}

async function loadStudents() {
  const el = qs('#fac-students');
  try {
    const res = await api('/facilitator/students');
    if (!res.students.length) {
      el.innerHTML = `<div class="panel-body">${emptyState('No students yet', 'Students enrolled in your classes will appear here.')}</div>`;
      return;
    }
    el.innerHTML = `<div class="panel-body" style="padding-top:6px">
      ${res.students.map((s) => `
      <div class="item-row">
        ${avatar(s, 44)}
        <div class="grow"><span class="t">${esc(s.name)}</span><span class="s">${esc(s.matricNo || '')} · ${esc(s.email)}${s.phone ? ' · ' + esc(s.phone) : ''}</span></div>
        <span class="badge badge-blue">${s.myClasses.length} class${s.myClasses.length === 1 ? '' : 'es'}</span>
        <button class="btn btn-outline btn-sm" data-view-student="${esc(s.id)}">View</button>
      </div>`).join('')}
    </div>`;
    await hydrateFiles(el);

    qsa('[data-view-student]', el).forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const d = await api(`/facilitator/students/${btn.dataset.viewStudent}`);
          const rows = d.results.length ? d.results.map((r) => `
            <tr>
              <td>${esc(r.classTitle)}</td>
              <td>${esc(r.assessmentTitle)}</td>
              <td>${esc(r.type)}</td>
              <td>${r.submitted ? (r.score != null ? `${esc(r.score)}/${esc(r.maxScore)}` : '<span class="badge badge-amber">Awaiting</span>') : '<span class="badge badge-gray">—</span>'}</td>
              <td>${r.pct != null ? gradeBadge(r.pct) : '—'}</td>
            </tr>`).join('') : '<tr><td colspan="5" class="center muted" style="padding:18px">No assessments in your classes yet.</td></tr>';
          openModal({
            title: `Student Record — ${esc(d.student.name)}`,
            wide: true,
            body: `
              <div class="row mb-2" style="gap:16px">
                ${avatar(d.student, 64)}
                <div style="flex:1;min-width:200px">
                  <strong style="color:var(--navy-800)">${esc(d.student.name)}</strong>
                  <div class="small muted">${esc(d.student.matricNo || '')} · ${esc(d.student.email)}${d.student.phone ? ' · ' + esc(d.student.phone) : ''}</div>
                  ${d.student.address ? `<div class="small muted">${esc(d.student.address)}</div>` : ''}
                  ${d.student.guardianName ? `<div class="small muted">Guardian: ${esc(d.student.guardianName)}${d.student.guardianPhone ? ' (' + esc(d.student.guardianPhone) + ')' : ''}</div>` : ''}
                </div>
                ${d.average != null ? `<div class="center">${gradeBadge(d.average)}<div class="small muted">Average</div></div>` : ''}
              </div>
              <div class="table-wrap card-flat"><table class="tbl">
                <thead><tr><th>Class</th><th>Assessment</th><th>Type</th><th>Score</th><th>Grade</th></tr></thead>
                <tbody>${rows}</tbody>
              </table></div>`,
            footer: '<button class="btn btn-dark" data-close>Close</button>',
          });
          await hydrateFiles(document.getElementById('modal-root'));
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="panel-body"><div class="form-error">${esc(e.message)}</div></div>`;
  }
}

function bindStudents() {
  loadStudents();
}

// ---------- profile ----------

function profileTab() {
  const me = DATA.facilitator;
  return `
  <div class="grid-2" style="align-items:start">
    <div class="panel">
      <div class="panel-head"><h3>Profile Picture</h3></div>
      <div class="panel-body">
        <div class="passport-box">
          ${avatar(me, 96)}
          <div>
            <label class="file-drop" id="fphoto-drop" style="min-width:230px">📷 Click to upload a photo (JPG/PNG, max 4 MB)<input type="file" id="fphoto-file" accept="image/*"></label>
            <p class="hint mt-1">Students and the admin will see this picture next to your name.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>My Details</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          ${field('Email Address', input('fp-email', { value: me.email, attrs: 'disabled' }))}
          ${field('Phone Number', input('fp-phone', { value: me.phone || '' }))}
          <div class="full">${field('Full Name *', input('fp-name', { value: me.name, required: true }))}</div>
          <div class="full">${field('Area of Expertise', input('fp-expertise', { value: me.expertise || '', placeholder: 'e.g. Networking & System Security' }))}</div>
          <div class="full">${field('Short Bio', textarea('fp-bio', me.bio || '', 3))}</div>
        </div>
        <div class="row spread mt-2">
          <span class="small muted">Facilitator since ${fmtDate(me.createdAt)}</span>
          <button class="btn btn-primary" id="fp-save">Save Changes</button>
        </div>
      </div>
    </div>
  </div>

  <div class="panel" style="max-width:520px">
    <div class="panel-head"><h3>Change Password</h3></div>
    <div class="panel-body">
      ${field('Current Password', input('fcp-current', { type: 'password' }))}
      ${field('New Password', input('fcp-new', { type: 'password' }), 'At least 6 characters.')}
      ${field('Confirm New Password', input('fcp-confirm', { type: 'password' }))}
      <button class="btn btn-dark" id="fcp-save">Update Password</button>
    </div>
  </div>`;
}

function bindProfile() {
  const drop = qs('#fphoto-drop');
  qs('#fphoto-file').addEventListener('change', async () => {
    try {
      const file = await readFileInfo(qs('#fphoto-file'));
      if (!file) return;
      drop.innerHTML = '⏳ Uploading…';
      const res = await api('/me/photo', { method: 'POST', body: { file } });
      updateUser(res.user);
      toast('Profile picture updated!');
      render({ tab: 'profile' });
    } catch (e) {
      toast(e.message, 'error');
      drop.innerHTML = '📷 Click to upload a photo (JPG/PNG, max 4 MB)<input type="file" id="fphoto-file" accept="image/*">';
    }
  });

  qs('#fp-save').addEventListener('click', async () => {
    try {
      const res = await api('/me', {
        method: 'PUT',
        body: { name: val('fp-name'), phone: val('fp-phone'), expertise: val('fp-expertise'), bio: val('fp-bio') },
      });
      updateUser(res.user);
      toast('Profile updated!');
      render({ tab: 'profile' });
    } catch (e) { toast(e.message, 'error'); }
  });

  qs('#fcp-save').addEventListener('click', async () => {
    if (val('fcp-new') !== val('fcp-confirm')) return toast('New passwords do not match.', 'error');
    try {
      const res = await api('/me/password', { method: 'PUT', body: { currentPassword: val('fcp-current'), newPassword: val('fcp-new') } });
      toast(res.message || 'Password updated!');
      ['fcp-current', 'fcp-new', 'fcp-confirm'].forEach((id) => { qs('#' + id).value = ''; });
    } catch (e) { toast(e.message, 'error'); }
  });
}
