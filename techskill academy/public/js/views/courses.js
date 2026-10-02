/** Courses page — full details of every course & live class batches. */
import { api } from '../api.js';
import { esc, landingNav, footer, bindLandingNav, fmtDate } from '../ui.js';
import { COURSES, SITE } from '../data.js';

export async function render() {
  // Live batches (from the API) if available
  let liveClasses = {};
  try {
    const data = await api('/public/courses');
    for (const c of data.courses) {
      liveClasses[c.id] = c.classes || [];
    }
  } catch { /* offline preview */ }

  const check = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11"/></svg>`;

  const app = document.getElementById('app');
  app.innerHTML = `
  ${landingNav('courses')}

  <section class="hero" style="background:linear-gradient(160deg,var(--navy-900),var(--navy-800) 55%,var(--navy-700))">
    <div class="container" style="padding:58px 0 62px">
      <span class="eyebrow">Our Courses</span>
      <h1 style="color:#fff;font-size:clamp(1.9rem,4vw,2.8rem);max-width:720px">Six professional tracks, taught 100% practically.</h1>
      <p style="color:#C7D2E8;max-width:640px;margin-top:12px">Every course runs at Beginner, Intermediate and Advanced levels, with weekday and weekend batches. Certificate awarded at every level.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${COURSES.map((c) => `
      <div class="course-detail" id="${c.id}">
        <div class="head">
          <div class="course-icon">${c.icon}</div>
          <div style="flex:1;min-width:240px">
            <div class="row" style="gap:8px"><span class="badge badge-navy">${esc(c.code)}</span><span class="badge badge-amber">${esc(c.duration)}</span></div>
            <h2 style="margin-top:10px;font-size:1.45rem">${esc(c.title)}</h2>
            <p class="muted">${esc(c.tagline)}</p>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px;align-items:flex-start">
            <a class="btn btn-primary" href="#/contact">Enroll in this course</a>
            <a class="small" href="#/signup">New student? Create your account →</a>
          </div>
        </div>
        <p style="max-width:860px">${esc(c.overview)}</p>
        <div class="mt-3 grid-2" style="align-items:start">
          <div>
            <h3 style="font-size:1rem;margin-bottom:6px">What you\u2019ll learn</h3>
            <ul class="topic-list">
              ${c.topics.map((t) => `<li>${check}<span>${esc(t)}</span></li>`).join('')}
            </ul>
          </div>
          <div>
            <h3 style="font-size:1rem;margin-bottom:6px">Outcomes</h3>
            <ul class="topic-list" style="grid-template-columns:1fr">
              ${c.outcomes.map((t) => `<li>${check}<span>${esc(t)}</span></li>`).join('')}
            </ul>
            <h3 style="font-size:1rem;margin:18px 0 8px">Upcoming / current batches</h3>
            ${(liveClasses[c.id] || []).length ? `
              <div class="panel card-flat">
                ${(liveClasses[c.id]).map((cls) => `
                <div class="item-row">
                  <div class="grow">
                    <span class="t">${esc(cls.title)}</span>
                    <span class="s">${esc(cls.level)} · ${esc(cls.schedule || 'Schedule to be announced')} · ${fmtDate(cls.startDate)} – ${fmtDate(cls.endDate)}</span>
                  </div>
                  <span class="badge badge-blue">${cls.facilitator ? esc(cls.facilitator.name) : 'Facilitator TBA'}</span>
                </div>`).join('')}
              </div>` : `<p class="muted small">New batches start every month — <a href="#/contact">contact us</a> for the next available date.</p>`}
          </div>
        </div>
      </div>`).join('')}

      <div class="cta-banner">
        <div>
          <h2>Not sure which course or level fits you?</h2>
          <p>Call or visit us and we\u2019ll place you correctly — ${esc(SITE.addressShort)} · ${SITE.phone}</p>
        </div>
        <a class="btn btn-primary btn-lg" href="#/contact" style="position:relative;z-index:2">Get Free Advice</a>
      </div>
    </div>
  </section>

  ${footer()}
  `;
  bindLandingNav();
}
