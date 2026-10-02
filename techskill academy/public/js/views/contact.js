/** Contact / enrollment page. */
import { api } from '../api.js';
import { esc, landingNav, footer, bindLandingNav, toast, field, input, textarea, select, val, qs } from '../ui.js';
import { SITE, COURSES } from '../data.js';

const SUBJECTS = ['Admission Enquiry', ...COURSES.map((c) => c.title), 'Partnership / Other'];

export async function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
  ${landingNav('contact')}

  <section class="section">
    <div class="container">
      <div class="section-head">
        <span class="eyebrow">Contact &amp; Enrollment</span>
        <h2>Talk to us today — let\u2019s get you started.</h2>
        <p>Call, WhatsApp, email or simply walk into our campus. We\u2019ll advise you on the right course and level, and reserve your seat in the next batch.</p>
      </div>

      <div class="contact-grid">
        <div class="card">
          <div class="contact-info-card">
            <div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>
            <div><div class="t">Our Campus</div><div class="s">${esc(SITE.address)}</div></div>
          </div>
          <div class="contact-info-card">
            <div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
            <div><div class="t">Phone / WhatsApp</div><div class="s"><a href="tel:${SITE.phoneIntl}">${SITE.phone}</a> · <a href="${SITE.whatsapp}" target="_blank" rel="noopener">WhatsApp chat</a></div></div>
          </div>
          <div class="contact-info-card">
            <div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></div>
            <div><div class="t">Email</div><div class="s"><a href="mailto:${SITE.email}">${SITE.email}</a></div></div>
          </div>
          <div class="contact-info-card">
            <div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
            <div><div class="t">Opening Hours</div><div class="s">${esc(SITE.hours)}</div></div>
          </div>
          <a class="btn btn-green btn-block mt-2" style="background:#25D366;color:#fff" href="${SITE.whatsapp}" target="_blank" rel="noopener">
            Chat with us on WhatsApp
          </a>
        </div>

        <div class="card">
          <h3 style="margin-bottom:4px">Send us a message</h3>
          <p class="muted small" style="margin-bottom:18px">Fill this form and our team will get back to you shortly.</p>
          <div id="contact-form-msg"></div>
          <form id="contact-form" novalidate>
            <div class="form-grid">
              <div class="full">${field('Full Name *', input('cf-name', { placeholder: 'e.g. Adewale Ogunleye', required: true }))}</div>
              ${field('Email Address *', input('cf-email', { type: 'email', placeholder: 'you@example.com', required: true }))}
              ${field('Phone Number', input('cf-phone', { placeholder: 'e.g. 0803 000 0000' }))}
              <div class="full">${field('Subject', select('cf-subject', SUBJECTS, 'Admission Enquiry'))}</div>
              <div class="full">${field('Message *', textarea('cf-message', '', 5))}</div>
            </div>
            <button class="btn btn-primary btn-lg btn-block" id="cf-submit" type="submit">Send Message</button>
          </form>
        </div>
      </div>
    </div>
  </section>

  ${footer()}
  `;
  bindLandingNav();

  const form = qs('#contact-form');
  const msgBox = qs('#contact-form-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgBox.innerHTML = '';
    const payload = {
      name: val('cf-name'),
      email: val('cf-email'),
      phone: val('cf-phone'),
      subject: val('cf-subject'),
      message: val('cf-message'),
    };
    if (!payload.name || !payload.email || !payload.message) {
      msgBox.innerHTML = '<div class="form-error">Please fill in your name, email and message.</div>';
      return;
    }
    const btn = qs('#cf-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const res = await api('/public/contact', { method: 'POST', body: payload });
      form.reset();
      msgBox.innerHTML = `<div class="form-ok">${esc(res.message || 'Message sent!')}</div>`;
      toast('Message sent successfully!');
    } catch (err) {
      msgBox.innerHTML = `<div class="form-error">${esc(err.message)} — you can also reach us directly at ${SITE.phone} or ${SITE.email}.</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  });
}
