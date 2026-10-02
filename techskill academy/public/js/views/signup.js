/** Student self-signup page. */
import { api, setAuth, auth } from '../api.js';
import { esc, toast, field, input, qs } from '../ui.js';

export async function render() {
  // Already signed in → straight to the portal
  if (auth().user) {
    window.location.hash = `#/portal/${auth().user.role}`;
    return;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="login-wrap">
    <div class="login-card" style="max-width:500px">
      <div class="login-logo">
        <img src="assets/logo.jpeg" alt="TechSkill Academy">
        <div>
          <h2>Create Student Account</h2>
          <p class="login-sub">Sign up in seconds — enroll in classes, download materials, submit assessments and track your grades.</p>
        </div>
      </div>

      <div id="signup-error"></div>
      <form id="signup-form" novalidate>
        <div class="form-grid">
          <div class="full">${field('Full Name *', input('sg-name', { placeholder: 'e.g. Adewale Ogunleye', required: true }))}</div>
          ${field('Email Address *', input('sg-email', { type: 'email', placeholder: 'you@example.com', required: true }))}
          ${field('Phone Number', input('sg-phone', { placeholder: 'e.g. 0803 000 0000' }))}
          <div class="full">${field('Password *', input('sg-password', { type: 'password', placeholder: 'At least 6 characters' }))}</div>
          <div class="full">${field('Confirm Password *', input('sg-confirm', { type: 'password' }))}</div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" id="sg-submit" type="submit">Create My Account</button>
        <p class="hint center mt-2">You can complete your details (passport photograph, address, guardian…) after signing in.</p>
      </form>

      <div class="login-alt">Already have an account? <a href="#/login/student">Sign in</a> · <a href="#/">Back to website</a></div>
    </div>
  </div>`;

  qs('#signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = qs('#signup-error');
    errBox.innerHTML = '';

    const name = qs('#sg-name').value.trim();
    const email = qs('#sg-email').value.trim();
    const phone = qs('#sg-phone').value.trim();
    const password = qs('#sg-password').value;
    const confirm = qs('#sg-confirm').value;

    if (!name || !email || !password) {
      errBox.innerHTML = '<div class="form-error">Please fill in your name, email and password.</div>';
      return;
    }
    if (password.length < 6) {
      errBox.innerHTML = '<div class="form-error">Password must be at least 6 characters.</div>';
      return;
    }
    if (password !== confirm) {
      errBox.innerHTML = '<div class="form-error">Passwords do not match.</div>';
      return;
    }

    const btn = qs('#sg-submit');
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const res = await api('/auth/signup', { method: 'POST', body: { name, email, phone, password } });
      setAuth(res.token, res.user);
      toast(res.message || 'Account created — welcome!');
      window.location.hash = '#/portal/student';
    } catch (err) {
      errBox.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Create My Account';
    }
  });
}
