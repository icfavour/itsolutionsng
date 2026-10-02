/** Student portal. */
import { api, auth, updateUser, downloadFile } from '../api.js';
import {
  esc, qs, qsa, toast, openModal, confirmAction, avatar, hydrateFiles,
  fmtDate, fmtDateTime, fmtBytes, pct, gradeBadge, gradeOf,
  field, input, select, textarea, val, readFileInfo, fileExt,
  portalShell, bindPortal, emptyState, statusBadgeFor,
} from '../ui.js';

let DATA = null;

export async function render({ tab = 'dashboard' }) {
  DATA = await api('/student/overview');
  const student = DATA.student;
  const first = (student.name || '').split(' ')[0];

  const TITLES = {
    dashboard: ['Dashboard', `Welcome back, ${first}! Here is your learning snapshot.`],
    explore: ['Enroll in Classes', 'Browse available class batches and enroll yourself.'],
    classes: ['My Classes', 'Your enrolled classes, course materials and assessments.'],
    assessments: ['Assessments & Grades', 'Submit your work and track your scores.'],
    profile: ['My Profile', 'Your details, passport photograph and password.'],
  };
  const [title, subtitle] = TITLES[tab] || TITLES.dashboard;

  const content = {
    dashboard: dashboardTab,
    explore: exploreTab,
    classes: classesTab,
    assessments: assessmentsTab,
    profile: profileTab,
  }[tab] || dashboardTab;

  const app = document.getElementById('app');
  app.innerHTML = portalShell({ role: 'student', active: tab, title, subtitle, user: student, content: content() });
  bindPortal();
  bindCommon();
  const binders = { dashboard: bindDashboard, explore: bindExplore, classes: bindClasses, assessments: bindAssessments, profile: bindProfile };
  (binders[tab] || bindDashboard)();
  await hydrateFiles(app);
}

// ---------- shared bits ----------

function bindCommon() {
  qsa('[data-dl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await downloadFile(btn.dataset.dl, btn.dataset.name); }
      catch (e) { toast(e.message, 'error'); }
    });
  });
}

function statsHtml() {
  const s = DATA.stats;
  return `
  <div class="stat-cards">
    <div class="stat-card"><div class="n">${s.enrolled}</div><div class="l">Enrolled Classes</div></div>
    <div class="stat-card amber"><div class="n">${s.notSubmitted}</div><div class="l">Assessments Pending</div></div>
    <div class="stat-card"><div class="n">${s.awaitingGrading}</div><div class="l">Awaiting Grading</div></div>
    <div class="stat-card ${s.averageScore == null ? '' : s.averageScore >= 50 ? 'green' : 'red'}">
      <div class="n">${s.averageScore == null ? '—' : s.averageScore + '% ' + gradeBadge(s.averageScore, false)}</div><div class="l">Average Score</div>
    </div>
  </div>`;
}

function classChip(cls) {
  return `<span class="badge badge-blue">${esc(cls.courseCode)} · ${esc(cls.level)}</span>`;
}

// ---------- dashboard ----------

function dashboardTab() {
  const allMaterials = DATA.classes.flatMap((c) => c.materials.map((m) => ({ ...m, classTitle: c.title, courseCode: c.courseCode })))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 5);
  const allAssessments = DATA.classes.flatMap((c) => c.assessments.map((a) => ({ ...a, classTitle: c.title })))
    .filter((a) => a.mySubmission?.score == null)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0, 5);
  const s = DATA.student;

  return `
  ${statsHtml()}

  <div class="grid-2" style="align-items:start">
    <div class="panel">
      <div class="panel-head"><h3>Recent Materials</h3><a class="link-arrow" href="#/portal/student/classes">View all →</a></div>
      <div class="panel-body" style="padding-top:6px">
        ${allMaterials.length ? allMaterials.map((m) => `
        <div class="item-row">
          <div class="file-icon">${esc(fileExt(m.fileName))}</div>
          <div class="grow"><span class="t">${esc(m.title)}</span><span class="s">${esc(m.classTitle)} · ${fmtDate(m.uploadedAt)} · ${fmtBytes(m.size)}</span></div>
          <button class="btn btn-outline btn-sm" data-dl="${esc(m.fileKey)}" data-name="${esc(m.fileName)}">Download</button>
        </div>`).join('') : emptyState('No materials yet', 'Materials uploaded by your facilitators will appear here.')}
      </div>
    </div>

    <div>
      <div class="panel">
        <div class="panel-head"><h3>Open Assessments</h3><a class="link-arrow" href="#/portal/student/assessments">All assessments →</a></div>
        <div class="panel-body" style="padding-top:6px">
          ${allAssessments.length ? allAssessments.map((a) => `
          <div class="item-row">
            <div class="grow"><span class="t">${esc(a.title)}</span><span class="s">${esc(a.classTitle)} · ${esc(a.type)} · ${a.dueDate ? 'Due ' + fmtDate(a.dueDate) : 'No due date'}</span></div>
            ${statusBadgeFor(a)}
            ${a.mySubmission ? '' : `<button class="btn btn-primary btn-sm" data-open-submit="${esc(a.id)}">Submit</button>`}
          </div>`).join('') : emptyState('All caught up!', 'You have submitted everything. Well done.')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-body row" style="gap:16px">
          ${avatar(s, 64)}
          <div style="flex:1;min-width:160px">
            <strong style="color:var(--navy-800)">${esc(s.name)}</strong>
            <div class="small muted">${esc(s.matricNo)} · ${esc(s.email)}</div>
          </div>
          <a class="btn btn-outline btn-sm" href="#/portal/student/profile">View profile</a>
        </div>
      </div>
    </div>
  </div>`;
}

function bindDashboard() {
  bindSubmitButtons();
}

// ---------- explore / enroll ----------

function exploreTab() {
  const courses = [...new Set(DATA.availableClasses.map((c) => c.courseTitle))];
  if (!DATA.availableClasses.length) {
    return emptyState('No open classes right now', 'New batches are added regularly — check back soon or contact the academy.');
  }
  return `
  <div class="toolbar">
    <div style="flex:1;min-width:240px;max-width:340px">
      ${select('explore-course', ['All courses', ...courses], 'All courses')}
    </div>
    <span class="muted small" id="explore-count"></span>
  </div>
  <div class="grid-2" id="explore-grid">
    ${DATA.availableClasses.map((cls) => classCardExplore(cls)).join('')}
  </div>`;
}

function classCardExplore(cls) {
  return `
  <div class="card" data-course="${esc(cls.courseTitle)}">
    <div class="row" style="gap:8px">${classChip(cls)}<span class="badge badge-gray">${cls.enrolledCount} enrolled</span></div>
    <h3 class="mt-2" style="font-size:1.05rem">${esc(cls.title)}</h3>
    <p class="muted small mt-1">${esc(cls.courseTitle)}</p>
    <div class="small mt-2" style="color:var(--navy-700)">
      <div>👤 ${cls.facilitator ? esc(cls.facilitator.name) : 'Facilitator TBA'}</div>
      <div>🗓 ${esc(cls.schedule || 'Schedule TBA')}</div>
      <div>📆 ${fmtDate(cls.startDate)} – ${fmtDate(cls.endDate)}</div>
    </div>
    <button class="btn btn-primary btn-sm mt-3" data-enroll="${esc(cls.id)}">Enroll in this class</button>
  </div>`;
}

function bindExplore() {
  const filter = qs('#explore-course');
  const grid = qs('#explore-grid');
  const apply = () => {
    const v = filter.value;
    let shown = 0;
    qsa('[data-course]', grid).forEach((el) => {
      const show = v === 'All courses' || el.dataset.course === v;
      el.style.display = show ? '' : 'none';
      if (show) shown += 1;
    });
    qs('#explore-count').textContent = `${shown} class${shown === 1 ? '' : 'es'} available`;
  };
  filter.addEventListener('change', apply);
  apply();

  qsa('[data-enroll]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Enrolling…';
      try {
        const res = await api('/student/enroll', { method: 'POST', body: { classId: btn.dataset.enroll } });
        toast(res.message || 'Enrolled!');
        render({ tab: 'explore' });
      } catch (e) {
        toast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Enroll in this class';
      }
    });
  });
}

// ---------- my classes ----------

function classesTab() {
  if (!DATA.classes.length) {
    return emptyState('You have not enrolled in any class yet', 'Head over to "Enroll in Classes" to join your first batch.', '<a class="btn btn-primary" href="#/portal/student/explore">Browse Classes</a>');
  }
  return DATA.classes.map((cls) => `
  <div class="panel">
    <div class="panel-head">
      <div>
        <div class="row" style="gap:8px">${classChip(cls)}</div>
        <h3 class="mt-1">${esc(cls.title)}</h3>
        <div class="small muted">👤 ${cls.facilitator ? esc(cls.facilitator.name) : 'TBA'} · 🗓 ${esc(cls.schedule || 'TBA')} · 📆 ${fmtDate(cls.startDate)} – ${fmtDate(cls.endDate)}</div>
      </div>
      <button class="btn btn-danger-ghost btn-sm" data-drop="${esc(cls.id)}" data-title="${esc(cls.title)}">Leave class</button>
    </div>
    <div class="panel-body" style="padding-top:8px">
      <h4 style="font-size:.85rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:8px 0 4px">📚 Course Materials (${cls.materials.length})</h4>
      ${cls.materials.length ? cls.materials.map((m) => `
      <div class="item-row">
        <div class="file-icon">${esc(fileExt(m.fileName))}</div>
        <div class="grow"><span class="t">${esc(m.title)}</span><span class="s">${esc(m.description || '')}</span><span class="s">${esc(m.fileName)} · ${fmtBytes(m.size)} · ${fmtDate(m.uploadedAt)}</span></div>
        <button class="btn btn-outline btn-sm" data-dl="${esc(m.fileKey)}" data-name="${esc(m.fileName)}">Download</button>
      </div>`).join('') : '<p class="muted small">No materials uploaded yet.</p>'}

      <h4 style="font-size:.85rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:18px 0 4px">📝 Assessments (${cls.assessments.length})</h4>
      ${cls.assessments.length ? cls.assessments.map((a) => `
      <div class="item-row">
        <div class="grow"><span class="t">${esc(a.title)}</span><span class="s">${esc(a.type)} · Max ${a.maxScore} · ${a.dueDate ? 'Due ' + fmtDate(a.dueDate) : 'No due date'}</span></div>
        ${statusBadgeFor(a)}
        ${a.mySubmission?.score != null
          ? `<button class="btn btn-ghost btn-sm" data-view-sub="${esc(a.id)}">View feedback</button>`
          : `<button class="btn btn-primary btn-sm" data-open-submit="${esc(a.id)}">${a.mySubmission ? 'Resubmit' : 'Submit'}</button>`}
      </div>`).join('') : '<p class="muted small">No assessments yet.</p>'}
    </div>
  </div>`).join('');
}

function bindClasses() {
  bindSubmitButtons();
  bindViewFeedback();

  qsa('[data-drop]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction(`Leave <b>${esc(btn.dataset.title)}</b>? You will no longer see its materials or assessments.`);
      if (!ok) return;
      try {
        const res = await api('/student/drop', { method: 'POST', body: { classId: btn.dataset.drop } });
        toast(res.message || 'You have left the class.');
        render({ tab: 'classes' });
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ---------- assessments & grades ----------

function assessmentsTab() {
  const rows = DATA.classes.flatMap((cls) =>
    cls.assessments.map((a) => ({ ...a, classTitle: cls.title, courseCode: cls.courseCode }))
  ).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

  if (!rows.length) {
    return emptyState('No assessments yet', 'Assessments created by your facilitators will appear here.', '<a class="btn btn-primary" href="#/portal/student/explore">Enroll in a Class</a>');
  }

  return `
  <div class="panel card-flat">
    <div class="panel-body" style="padding:10px 20px">
      <span class="small muted">Grading scale:</span>
      <span class="badge badge-green">A: 70–100</span>
      <span class="badge badge-green">B: 60–69</span>
      <span class="badge badge-grade-warn">C: 50–59</span>
      <span class="badge badge-grade-warn">D: 45–49</span>
      <span class="badge badge-grade-bad">E: 40–44</span>
      <span class="badge badge-red">F: below 40</span>
    </div>
  </div>
  <div class="table-wrap">
    <table class="tbl">
      <thead><tr><th>Class</th><th>Assessment</th><th>Type</th><th>Max</th><th>Due</th><th>Status / Score</th><th>Action</th></tr></thead>
      <tbody>
        ${rows.map((a) => `
        <tr>
          <td><span class="badge badge-blue">${esc(a.courseCode)}</span></td>
          <td><strong>${esc(a.title)}</strong><span class="user-cell-sub small muted" style="display:block">${esc(a.classTitle)}</span></td>
          <td>${esc(a.type)}</td>
          <td>${a.maxScore}</td>
          <td>${a.dueDate ? fmtDate(a.dueDate) : '—'}</td>
          <td>${statusBadgeFor(a)}</td>
          <td>
            ${a.mySubmission?.score != null
              ? `<button class="btn btn-ghost btn-sm" data-view-sub="${esc(a.id)}">Feedback</button>`
              : `<button class="btn btn-primary btn-sm" data-open-submit="${esc(a.id)}">${a.mySubmission ? 'Resubmit' : 'Submit'}</button>`}
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function bindAssessments() {
  bindSubmitButtons();
  bindViewFeedback();
}

function findAssessment(id) {
  for (const cls of DATA.classes) {
    const a = cls.assessments.find((x) => x.id === id);
    if (a) return { a, cls };
  }
  return { a: null, cls: null };
}

function bindSubmitButtons() {
  qsa('[data-open-submit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { a, cls } = findAssessment(btn.dataset.openSubmit);
      if (a) openSubmitModal(a, cls);
    });
  });
}

function bindViewFeedback() {
  qsa('[data-view-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { a } = findAssessment(btn.dataset.viewSub);
      if (!a?.mySubmission) return;
      const s = a.mySubmission;
      const p = pct(s.score, a.maxScore);
      const [g, label] = gradeOf(p);
      openModal({
        title: `Feedback — ${esc(a.title)}`,
        body: `
          <div class="row mb-2">${gradeBadge(p)}<span class="muted small">${label}</span></div>
          <div class="row mb-2" style="gap:18px">
            <div><div class="score-big" style="color:var(--navy-800)">${esc(s.score)}/${esc(a.maxScore)}</div><div class="small muted">Score</div></div>
            <div><div class="score-big" style="color:var(--navy-800)">${p}%</div><div class="small muted">Percentage</div></div>
          </div>
          ${s.feedback ? `<div class="field"><label>Facilitator\u2019s feedback</label><div class="card card-flat" style="background:#FFFBEB;border-color:#FDE68A">${esc(s.feedback)}</div></div>` : ''}
          ${s.content ? `<div class="field"><label>Your submission</label><div class="card card-flat small" style="white-space:pre-wrap">${esc(s.content)}</div></div>` : ''}
          ${s.fileKey ? `<button class="btn btn-outline btn-sm" data-dl="${esc(s.fileKey)}" data-name="${esc(s.fileName || 'submission')}">📎 ${esc(s.fileName || 'Download attachment')}</button>` : ''}
          <p class="hint mt-2">Submitted ${fmtDateTime(s.submittedAt)}${s.late ? ' · <span style="color:var(--red)">Late submission</span>' : ''}</p>`,
        footer: '<button class="btn btn-dark" data-close>Close</button>',
      });
      // bind download inside modal
      const el = document.getElementById('modal-root').lastElementChild;
      el?.querySelector('[data-dl]')?.addEventListener('click', async (e) => {
        const b = e.currentTarget;
        try { await downloadFile(b.dataset.dl, b.dataset.name); } catch (err) { toast(err.message, 'error'); }
      });
    });
  });
}

function openSubmitModal(a, cls) {
  const existing = a.mySubmission;
  const m = openModal({
    title: `Submit — ${esc(a.title)}`,
    body: `
      <p class="muted small mb-2">${esc(cls.title)} · ${esc(a.type)} · Max score ${a.maxScore}${a.dueDate ? ' · Due ' + fmtDate(a.dueDate) : ''}</p>
      <div class="field"><label>Your answer</label>${textarea('sub-text', existing?.content || '', 6)}</div>
      <div class="field">
        <label>Attach a file (optional)</label>
        <label class="file-drop" id="sub-drop">📄 Click to choose a file (max 4 MB)<input type="file" id="sub-file"></label>
      </div>
      ${existing ? '<p class="hint">You have already submitted. Submitting again replaces your previous answer (until it is graded).</p>' : ''}`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="sub-save">Submit Assessment</button>`,
  });

  const drop = qs('#sub-drop', m.el);
  qs('#sub-file', m.el).addEventListener('change', () => {
    const f = qs('#sub-file', m.el).files[0];
    if (f) { drop.classList.add('has-file'); drop.innerHTML = `✅ ${esc(f.name)} (${fmtBytes(f.size)})<input type="file" id="sub-file">`; }
  });

  qs('#sub-save', m.el).addEventListener('click', async () => {
    const btn = qs('#sub-save', m.el);
    try {
      btn.disabled = true;
      btn.textContent = 'Submitting…';
      const file = await readFileInfo(qs('#sub-file', m.el));
      const res = await api('/student/submit', {
        method: 'POST',
        body: { assessmentId: a.id, content: val('sub-text', m.el), file },
      });
      m.close();
      toast(res.ok ? 'Submitted successfully!' : 'Submitted.');
      render({ tab: 'assessments' });
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Assessment';
    }
  });
}

// ---------- profile ----------

function profileTab() {
  const s = DATA.student;
  return `
  <div class="grid-2" style="align-items:start">
    <div class="panel">
      <div class="panel-head"><h3>Passport Photograph</h3></div>
      <div class="panel-body">
        <div class="passport-box">
          ${avatar(s, 96)}
          <div>
            <label class="file-drop" id="photo-drop" style="min-width:230px">📷 Click to upload passport (JPG/PNG, max 4 MB)<input type="file" id="photo-file" accept="image/*"></label>
            <p class="hint mt-1">A clear passport photograph is required for your academy record and certificate.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Personal Details</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          ${field('Matric Number', input('pf-matric', { value: s.matricNo, attrs: 'disabled' }))}
          ${field('Email Address', input('pf-email', { value: s.email, attrs: 'disabled' }))}
          <div class="full">${field('Full Name *', input('pf-name', { value: s.name, required: true }))}</div>
          ${field('Phone Number', input('pf-phone', { value: s.phone || '', placeholder: 'e.g. 0703 000 0000' }))}
          ${field('Date of Birth', input('pf-dob', { type: 'date', value: s.dob || '' }))}
          ${field('Gender', select('pf-gender', ['', 'Male', 'Female'], s.gender || ''))}
          <div class="full">${field('Home Address', input('pf-address', { value: s.address || '' }))}</div>
          ${field('Guardian Name', input('pf-guardian', { value: s.guardianName || '' }))}
          ${field('Guardian Phone', input('pf-guardian-phone', { value: s.guardianPhone || '' }))}
        </div>
        <div class="row spread mt-2">
          <span class="small muted">Enrolled since ${fmtDate(s.createdAt)}</span>
          <button class="btn btn-primary" id="pf-save">Save Changes</button>
        </div>
      </div>
    </div>
  </div>

  <div class="panel" style="max-width:520px">
    <div class="panel-head"><h3>Change Password</h3></div>
    <div class="panel-body">
      ${field('Current Password', input('cp-current', { type: 'password' }))}
      ${field('New Password', input('cp-new', { type: 'password' }), 'At least 6 characters.')}
      ${field('Confirm New Password', input('cp-confirm', { type: 'password' }))}
      <button class="btn btn-dark" id="cp-save">Update Password</button>
    </div>
  </div>`;
}

function bindProfile() {
  // passport upload
  const photoInput = qs('#photo-file');
  const drop = qs('#photo-drop');
  photoInput.addEventListener('change', async () => {
    try {
      const file = await readFileInfo(photoInput);
      if (!file) return;
      drop.innerHTML = '⏳ Uploading passport…';
      const res = await api('/me/photo', { method: 'POST', body: { file } });
      updateUser(res.user);
      toast('Passport photograph updated!');
      render({ tab: 'profile' });
    } catch (e) {
      toast(e.message, 'error');
      drop.innerHTML = '📷 Click to upload passport (JPG/PNG, max 4 MB)<input type="file" id="photo-file" accept="image/*">';
    }
  });

  // details form
  qs('#pf-save').addEventListener('click', async () => {
    try {
      const res = await api('/me', {
        method: 'PUT',
        body: {
          name: val('pf-name'), phone: val('pf-phone'), dob: val('pf-dob'), gender: val('pf-gender'),
          address: val('pf-address'), guardianName: val('pf-guardian'), guardianPhone: val('pf-guardian-phone'),
        },
      });
      updateUser(res.user);
      toast('Profile updated successfully!');
      render({ tab: 'profile' });
    } catch (e) { toast(e.message, 'error'); }
  });

  // password
  qs('#cp-save').addEventListener('click', async () => {
    const current = val('cp-current');
    const next = val('cp-new');
    if (next !== val('cp-confirm')) { toast('New passwords do not match.', 'error'); return; }
    try {
      const res = await api('/me/password', { method: 'PUT', body: { currentPassword: current, newPassword: next } });
      toast(res.message || 'Password updated!');
      qs('#cp-current').value = qs('#cp-new').value = qs('#cp-confirm').value = '';
    } catch (e) { toast(e.message, 'error'); }
  });
}
