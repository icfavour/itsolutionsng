/** Home (landing) page. */
import { api } from '../api.js';
import { esc, landingNav, footer, bindLandingNav, hydrateFiles } from '../ui.js';
import { SITE, COURSES, WHY_US, LEVEL_INFO } from '../data.js';

export async function render() {
  // Live stats are a bonus — fall back to marketing numbers if the API is unreachable.
  let stats = { students: 500, facilitators: 6, classes: 9, courses: 6 };
  try { stats = { ...stats, ...(await api('/public/summary')) }; } catch { /* offline preview */ }

  const app = document.getElementById('app');
  app.innerHTML = `
  ${landingNav('')}

  <section class="hero">
    <div class="container hero-inner">
      <div>
        <span class="eyebrow">TechSkill Academy · Ikorodu, Lagos</span>
        <h1>Master practical tech skills, <span class="hl">from zero to pro.</span></h1>
        <p class="lead">CCTV installation &amp; maintenance, computer hardware repair, programming, data analysis, networking &amp; system security, and general ICT — hands-on training at every level, right here in Ikorodu.</p>
        <div class="row">
          <a class="btn btn-primary btn-lg" href="#/courses">Explore Our Courses</a>
          <a class="btn btn-outline-light btn-lg" href="#/contact">Talk to Us</a>
        </div>
        <div class="hero-trust">
          <span>✔ 100% practical labs</span>
          <span>✔ Certificate at every level</span>
          <span>✔ Weekday &amp; weekend batches</span>
        </div>
      </div>
      <div class="hero-media">
        <img src="assets/hero.jpg" alt="Students in a practical ICT training session at TechSkill Academy">
        <div class="hero-card a"><span class="big">${stats.students}+</span><small>Students trained</small></div>
        <div class="hero-card b"><span class="big">${stats.courses}</span><small>Professional courses</small></div>
      </div>
    </div>
  </section>

  <div class="container">
    <div class="stats-strip">
      <div class="stat-box"><div class="n">${stats.courses}</div><div class="l">Expert-Led Courses</div></div>
      <div class="stat-box"><div class="n">3 Levels</div><div class="l">Beginner → Advanced</div></div>
      <div class="stat-box"><div class="n">${stats.facilitators}</div><div class="l">Certified Facilitators</div></div>
      <div class="stat-box"><div class="n">${stats.classes}</div><div class="l">Active Class Batches</div></div>
    </div>
  </div>

  <section class="section">
    <div class="container">
      <div class="section-head center">
        <span class="eyebrow">Our Courses</span>
        <h2>Six professional tracks. Every level.</h2>
        <p>Each course runs at Beginner, Intermediate and Advanced levels — so you can start from scratch or sharpen what you already know.</p>
      </div>
      <div class="grid-3">
        ${COURSES.map((c) => `
        <a class="course-card" href="#/courses" style="text-decoration:none">
          <div class="course-icon">${c.icon}</div>
          <h3>${esc(c.title)}</h3>
          <p class="tagline">${esc(c.tagline)}</p>
          <div class="chips">
            ${c.levels.map((l) => `<span class="badge badge-blue">${l}</span>`).join('')}
            <span class="badge badge-amber">${esc(c.duration)}</span>
          </div>
          <div class="foot"><span class="link-arrow">View details →</span></div>
        </a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <span class="eyebrow">Why TechSkill Academy</span>
        <h2>Training that actually gets you job-ready</h2>
        <p>We don\u2019t just teach theory — you touch the equipment, write the code, and build the portfolio.</p>
      </div>
      <div class="grid-3">
        ${WHY_US.map((f) => `
        <div class="feature">
          <div class="feature-icon">${f.icon}</div>
          <div><h4>${esc(f.title)}</h4><p>${esc(f.text)}</p></div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head center">
        <span class="eyebrow">All Levels of the Academy</span>
        <h2>A clear path from beginner to professional</h2>
      </div>
      <div class="grid-3" style="padding-top:16px">
        ${LEVEL_INFO.map((l, i) => `
        <div class="level-card">
          <span class="step">LEVEL ${i + 1}</span>
          <h3>${esc(l.title)}</h3>
          <p>${esc(l.text)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="cta-banner">
        <div>
          <h2>Ready to start your tech journey?</h2>
          <p>Visit us at ${esc(SITE.address)} — or call <a href="tel:${SITE.phoneIntl}" style="color:#FBBF24;font-weight:700">${SITE.phone}</a> today.</p>
        </div>
        <div class="row" style="position:relative;z-index:2">
          <a class="btn btn-primary btn-lg" href="#/contact">Enroll Now</a>
          <a class="btn btn-outline-light btn-lg" href="#/signup">Create Student Account</a>
          <a class="btn btn-outline-light btn-lg" href="${SITE.whatsapp}" target="_blank" rel="noopener">WhatsApp Us</a>
        </div>
      </div>
    </div>
  </section>

  ${footer()}
  `;
  bindLandingNav();
  await hydrateFiles(app);
}
