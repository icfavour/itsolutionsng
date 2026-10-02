/** App bootstrap + hash router. */
import { initAuth, auth, isLoggedIn } from './api.js';
import { errorPage, toast } from './ui.js';
import * as home from './views/home.js';
import * as courses from './views/courses.js';
import * as about from './views/about.js';
import * as contact from './views/contact.js';
import * as login from './views/login.js';
import * as student from './views/student.js';
import * as facilitator from './views/facilitator.js';
import * as admin from './views/admin.js';

const app = document.getElementById('app');
const ROLES = ['student', 'facilitator', 'admin'];
const VIEWS = { student, facilitator, admin };

async function router() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const segs = hash ? hash.split('/').map(decodeURIComponent) : [];

  try {
    if (segs.length === 0) {
      await home.render();
    } else if (segs[0] === 'courses') {
      await courses.render();
    } else if (segs[0] === 'about') {
      await about.render();
    } else if (segs[0] === 'contact') {
      await contact.render();
    } else if (segs[0] === 'login' && ROLES.includes(segs[1])) {
      await login.render(segs[1]);
    } else if (segs[0] === 'signup') {
      await signup.render();
    } else if (segs[0] === 'portal' && ROLES.includes(segs[1])) {
      const role = segs[1];
      if (!isLoggedIn() || auth().user.role !== role) {
        toast('Please sign in to continue.', 'info');
        window.location.hash = `#/login/${role}`;
        return;
      }
      await VIEWS[role].render({ tab: segs[2] || 'dashboard' });
    } else {
      await home.render();
    }
    window.scrollTo(0, 0);
  } catch (err) {
    app.innerHTML = errorPage(err.message || 'Something went wrong.');
  }
}

initAuth();
window.addEventListener('hashchange', router);
router();
