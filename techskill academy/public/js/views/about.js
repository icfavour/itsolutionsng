/** About page. */
import { esc, landingNav, footer, bindLandingNav } from '../ui.js';
import { SITE, WHY_US } from '../data.js';

export async function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
  ${landingNav('about')}

  <section class="section">
    <div class="container">
      <div class="about-grid">
        <div>
          <span class="eyebrow">About Us</span>
          <h2 style="font-size:clamp(1.7rem,3.4vw,2.4rem)">Building Ikorodu\u2019s next generation of tech professionals.</h2>
          <p class="muted mt-2">TechSkill Academy is a practical technology training centre located at ${esc(SITE.address)}. We exist to close the gap between ordinary computer literacy and real, income-earning tech skill.</p>
          <p class="muted mt-2">From CCTV technicians who secure estates and businesses, to programmers and data analysts who power modern companies, our graduates leave with skills they have actually practised — not just notes they have copied.</p>
          <p class="muted mt-2">We train school leavers, corps members, working professionals, business owners and complete beginners — at every level of the academy.</p>
          <div class="row mt-3">
            <a class="btn btn-primary" href="#/courses">See Our Courses</a>
            <a class="btn btn-outline" href="#/contact">Visit Us</a>
          </div>
        </div>
        <div>
          <img src="assets/about.jpg" alt="Instructor guiding students assembling a computer at TechSkill Academy" style="border-radius:18px;box-shadow:var(--shadow-lg)">
        </div>
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="grid-2">
        <div class="card mv-card">
          <h3>🎯 Our Mission</h3>
          <p class="muted mt-1">To deliver affordable, practical, industry-relevant technology training that turns absolute beginners into confident, employable professionals.</p>
        </div>
        <div class="card mv-card" style="border-left-color:var(--blue)">
          <h3>🔭 Our Vision</h3>
          <p class="muted mt-1">To be Lagos State\u2019s most trusted ICT academy — known for graduates who can genuinely do the work from day one.</p>
        </div>
      </div>
      <div class="grid-3 mt-4">
        ${WHY_US.slice(0, 3).map((f) => `
        <div class="feature">
          <div class="feature-icon">${f.icon}</div>
          <div><h4>${esc(f.title)}</h4><p>${esc(f.text)}</p></div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="grid-3">
        <div class="card center">
          <div style="font-size:2rem">📍</div>
          <h3 class="card-title mt-1">Visit Our Campus</h3>
          <p class="muted small">${esc(SITE.address)}</p>
        </div>
        <div class="card center">
          <div style="font-size:2rem">📞</div>
          <h3 class="card-title mt-1">Call or WhatsApp</h3>
          <p class="muted small"><a href="tel:${SITE.phoneIntl}">${SITE.phone}</a> · <a href="${SITE.whatsapp}" target="_blank" rel="noopener">Chat on WhatsApp</a></p>
        </div>
        <div class="card center">
          <div style="font-size:2rem">🕘</div>
          <h3 class="card-title mt-1">Opening Hours</h3>
          <p class="muted small">${esc(SITE.hours)}</p>
        </div>
      </div>
    </div>
  </section>

  ${footer()}
  `;
  bindLandingNav();
}
