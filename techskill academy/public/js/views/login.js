/** Login page for all three portals. */
import { api, setAuth, auth } from '../api.js';
import { esc, toast, field, input, qs } from '../ui.js';

const META = {
  student: {
    title: 'Student Portal',
    desc: 'Sign in to view your classes, materials, assessments and grades.',
  },
  facilitator: {
    title: 'Facilitator Portal',
    desc: 'Sign in to upload course materials, create assessments and grade students.',
  },
  admin: {
    title: 'Admin Login',
    desc: 'Sign in to manage student and facilitator accounts, classes and messages.',
  },
};

export async function render(role) {
  const meta = META[role];
  const app = document.getElementById('app');

  // Already signed in as this role → go straight to the portal
  if (auth().user?.role === role) {
    window.location.hash = `#/portal/${role}`;
    return;
  }

  app.innerHTML = `
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">
        <img src="assets/logo.jpeg" alt="TechSkill Academy">
        <div>
          <h2>${meta.title}</h2>
          <p class="login-sub">${meta.desc}</p>
        </div>
      </div>

      <div id="login-error"></div>
      <form id="login-form" novalidate>
        ${field('Email Address', input('lg-email', { type: 'email', placeholder: 'you@example.com', required: true, attrs: 'autocomplete="username"' }))}
        <div class="field">
          <label>Password</label>
          <div class="pw-wrap">
            <input class="input" id="lg-password" type="password" placeholder="Your password" autocomplete="current-password">
            <button class="pw-toggle" id="pw-toggle" type="button" aria-label="Show password">👁</button>
          </div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" id="lg-submit" type="submit">Sign In</button>
      </form>

      ${role === 'student' ? '<div class="login-alt" style="margin-top:16px">New student? <a href="#/signup">Create an account →</a></div>' : ''}

      <div class="login-alt">
        ${role !== 'student' ? '<a href="#/login/student">Student Portal</a> · ' : ''}
        ${role !== 'facilitator' ? '<a href="#/login/facilitator">Facilitator Portal</a> · ' : ''}
        ${role !== 'admin' ? '<a href="#/login/admin">Admin</a> · ' : ''}
        <a href="#/">Back to website</a>
      </div>
    </div>
  </div>`;

  qs('#pw-toggle').addEventListener('click', () => {
    const pw = qs('#lg-password');
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });

  qs('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = qs('#login-error');
    errBox.innerHTML = '';
    const email = qs('#lg-email').value.trim();
    const password = qs('#lg-password').value;
    if (!email || !password) {
      errBox.innerHTML = '<div class="form-error">Please enter your email and password.</div>';
      return;
    }
    const btn = qs('#lg-submit');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const res = await api('/auth/login', { method: 'POST', body: { email, password } });
      if (res.user.role !== role) {
        errBox.innerHTML = `<div class="form-error">This account is registered as a ${esc(res.user.role)}. Please use the ${esc(res.user.role)} portal.</div>`;
        return;
      }
      setAuth(res.token, res.user);
      toast(`Welcome back, ${res.user.name.split(' ')[0]}!`);
      window.location.hash = `#/portal/${role}`;
    } catch (err) {
      errBox.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}
